"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agent = void 0;
const api_1 = require("@atproto/api");
const dotenv = __importStar(require("dotenv"));
const cron_1 = require("cron");
const process = __importStar(require("process"));
const axios_1 = __importDefault(require("axios"));
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
exports.agent = new api_1.AtpAgent({
    service: 'https://bsky.social',
    persistSession: (_evt, _sess) => {
        // We don't need to persist the session here
    },
});
// Calculate which otter to post based on the current date
function getOtterNumber() {
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - START_DATE.getTime()) / (1000 * 60 * 60 * 24));
    const postsElapsed = (daysDiff * POSTS_PER_DAY) +
        (now.getHours() >= 12 ? 1 : 0); // Add 1 if we're past noon
    return (postsElapsed % TOTAL_OTTERS) + 1;
}
function downloadOtterImage(otterNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = `https://raw.githubusercontent.com/DailyOttersBot/otters/refs/heads/main/otter%20(${otterNumber}).jpg`;
        const response = yield axios_1.default.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data, 'binary');
    });
}
function postOtter() {
    return __awaiter(this, arguments, void 0, function* (retryCount = 0) {
        try {
            const otterNumber = getOtterNumber();
            console.log(`Attempting to post otter #${otterNumber}`);
            // Login (in case session expired)
            yield exports.agent.login({
                identifier: identifier_env,
                password: password_env,
            });
            // Download the otter image
            const imageData = yield downloadOtterImage(otterNumber);
            // Upload the image
            const uploadResponse = yield exports.agent.uploadBlob(imageData, {
                encoding: 'image/jpeg',
            });
            // Create the post with the image
            yield exports.agent.post({
                text: `Otter #${otterNumber - 1} 🦦`,
                embed: {
                    $type: 'app.bsky.embed.images',
                    images: [{
                            alt: `A cute otter image #${otterNumber}`,
                            image: uploadResponse.data.blob,
                        }],
                },
            });
            console.log(`Successfully posted otter #${otterNumber}`);
        }
        catch (error) {
            console.error('Error posting otter:', error);
            if (retryCount < 5) { // Limit retries to prevent infinite loops
                console.log(`Retrying in 30 minutes... (Attempt ${retryCount + 1})`);
                setTimeout(() => postOtter(retryCount + 1), 30 * 60 * 1000);
            }
            else {
                console.error('Maximum retry attempts reached');
            }
        }
    });
}
// Schedule posts at 12-hour intervals
const morningPost = new cron_1.CronJob('0 0 0 * * *', postOtter); // 12:00 AM
const eveningPost = new cron_1.CronJob('0 0 12 * * *', postOtter); // 12:00 PM
// Start the cron jobs
morningPost.start();
eveningPost.start();
// Initial post if starting between scheduled times
const currentHour = new Date().getHours();
if (currentHour > 0 && currentHour < 12 && !morningPost.running) {
    postOtter();
}
else if (currentHour > 12 && !eveningPost.running) {
    postOtter();
}
console.log('Otter bot started! Posts scheduled for 12:00 AM and 12:00 PM daily.');
