import { AtpAgent, AtpSessionEvent, AtpSessionData } from '@atproto/api';
import * as dotenv from 'dotenv';
import { CronJob } from 'cron';
import * as process from 'process';
import axios from 'axios';

dotenv.config();

const TOTAL_OTTERS = 453;
const START_DATE = new Date('2024-11-16');
const POSTS_PER_DAY = 2;

const identifier_env = process.env.BSKY_IDENTIFIER;
const password_env = process.env.BSKY_PASSWORD;

if (!identifier_env || !password_env) {
  throw new Error('Missing environment variables: BSKY_IDENTIFIER or BSKY_PASSWORD');
}

// Configure connection to the server
export const agent = new AtpAgent({
  service: 'https://bsky.social',
  persistSession: (_evt: AtpSessionEvent, _sess?: AtpSessionData) => {
    // We don't need to persist the session here
  },
});

// Calculate which otter to post based on the current date
function getOtterNumber(): number {
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - START_DATE.getTime()) / (1000 * 60 * 60 * 24));
  const postsElapsed = (daysDiff * POSTS_PER_DAY) + 
    (now.getHours() >= 12 ? 1 : 0); // Add 1 if we're past noon

  return (postsElapsed % TOTAL_OTTERS) + 1;
}

async function downloadOtterImage(otterNumber: number): Promise<Buffer> {
  const url = `https://raw.githubusercontent.com/DailyOttersBot/otters/refs/heads/main/otter%20(${otterNumber}).jpg`;
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data, 'binary');
}

async function postOtter(retryCount = 0): Promise<void> {
  try {
    const otterNumber = getOtterNumber();
    console.log(`Attempting to post otter #${otterNumber}`);

    // Login (in case session expired)
    await agent.login({
      identifier: identifier_env!,
      password: password_env!,
    });

    // Download the otter image
    const imageData = await downloadOtterImage(otterNumber);

    // Upload the image
    const uploadResponse = await agent.uploadBlob(imageData, {
      encoding: 'image/jpeg',
    });

    // Create the post with the image
    await agent.post({
      text: `Otter #${otterNumber} 🦦`,
      embed: {
        $type: 'app.bsky.embed.images',
        images: [{
          alt: `A cute otter image #${otterNumber}`,
          image: uploadResponse.data.blob,
        }],
      },
    });

    console.log(`Successfully posted otter #${otterNumber}`);
  } catch (error) {
    console.error('Error posting otter:', error);
    
    if (retryCount < 5) { // Limit retries to prevent infinite loops
      console.log(`Retrying in 30 minutes... (Attempt ${retryCount + 1})`);
      setTimeout(() => postOtter(retryCount + 1), 30 * 60 * 1000);
    } else {
      console.error('Maximum retry attempts reached');
    }
  }
}

// Schedule posts at 12-hour intervals
const morningPost = new CronJob('0 0 0 * * *', postOtter); // 12:00 AM
const eveningPost = new CronJob('0 0 12 * * *', postOtter); // 12:00 PM

// Start the cron jobs
morningPost.start();
eveningPost.start();

// Initial post if starting between scheduled times
const currentHour = new Date().getHours();
if (currentHour > 0 && currentHour < 12 && !morningPost.running) {
  postOtter();
} else if (currentHour > 12 && !eveningPost.running) {
  postOtter();
}

console.log('Otter bot started! Posts scheduled for 12:00 AM and 12:00 PM daily.');