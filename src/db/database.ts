import pkg, { QueryResult } from 'pg';
import config from '../config/config';
import { TwitterTweet } from '../types/twitter';
const { Pool } = pkg;

// Twitter API 相关类型定义
interface TwitterCookies {
  id: number;
  cookies: string;
  created_at: Date;
  updated_at: Date;
}
// 回复推文接口
interface RepliedTweet {
  id: number;
  tweet_id: string;
  reply_text: string;
  original_tweet_json: TwitterTweet;
  score: number;
  reason: string;
  created_at: Date;
}

interface CountResult {
  count: string;
}

// 合并的账户档案接口
interface AccountProfile {
  id: number;
  points: number;
  username: string;
  first_mentioned_by: string | null;
  first_mentioned_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// 事件接口
interface Event {
  id: number;
  rowKey: string;
  level: string;
  name: string;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  content: any;
  target: string;
  username: string;
  created_at: Date;
}

// 创建连接池
const pool = new Pool({
  connectionString: config.database.url
});

// 初始化数据库表
async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    // Drop existing tables
    // await client.query(`
    //   DROP TABLE IF EXISTS x_replied_tweets CASCADE;
    //   DROP TABLE IF EXISTS x_account_profiles CASCADE;
    //   DROP TABLE IF EXISTS x_events CASCADE;
    //   DROP TABLE IF EXISTS x_twitter_cookies CASCADE;
    // `);

    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS x_twitter_cookies (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        cookies TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS x_replied_tweets (
        id SERIAL PRIMARY KEY,
        tweet_id TEXT NOT NULL,
        reply_text TEXT NOT NULL,
        original_tweet_json JSONB NOT NULL,
        score INTEGER,
        reason TEXT,
        username TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS x_account_profiles (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        points INTEGER DEFAULT 0,
        first_mentioned_by TEXT,
        first_mentioned_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS x_events (
        id SERIAL PRIMARY KEY,
        row_key TEXT NOT NULL UNIQUE,
        level TEXT NOT NULL,
        name TEXT NOT NULL,
        content JSONB,
        target TEXT NOT NULL,
        username TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } finally {
    client.release();
  }
}

// 初始化数据库
initializeDatabase().catch(console.error);

export async function saveCookies(
  username: string,
  cookies: string
): Promise<TwitterCookies | undefined> {
  const client = await pool.connect();
  try {
    const result: QueryResult<TwitterCookies> = await client.query(
      `INSERT INTO x_twitter_cookies (username, cookies, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (username) 
       DO UPDATE SET 
         cookies = EXCLUDED.cookies,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [username, cookies]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getLatestCookies(username: string): Promise<TwitterCookies | undefined> {
  const client = await pool.connect();
  try {
    const result: QueryResult<TwitterCookies> = await client.query(
      `SELECT * FROM x_twitter_cookies
       WHERE username = $1
       LIMIT 1`,
      [username]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function isTweetReplied(tweetId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result: QueryResult<CountResult> = await client.query(
      'SELECT COUNT(*) as count FROM x_replied_tweets WHERE tweet_id = $1',
      [tweetId]
    );
    return parseInt(result.rows[0]?.count ?? '0') > 0;
  } finally {
    client.release();
  }
}

// 更新保存回复推文的函数
export async function saveRepliedTweet(
  tweetId: string,
  replyText: string,
  originalTweetJson: TwitterTweet,
  score: number,
  reason: string
): Promise<RepliedTweet | undefined> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 保存回复的推文
    const result: QueryResult<RepliedTweet> = await client.query(
      `INSERT INTO x_replied_tweets (tweet_id, reply_text, original_tweet_json, score, reason, username)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tweetId, replyText, originalTweetJson, score, reason, originalTweetJson.user.screen_name]
    );

    // 处理作者信息
    if (originalTweetJson?.user?.screen_name) {
      await upsertAccountProfile(originalTweetJson.user.screen_name);
    }

    // 处理被提及用户
    if (originalTweetJson?.entities?.user_mentions) {
      for (const mention of originalTweetJson.entities.user_mentions) {
        if (mention.screen_name) {
          await upsertAccountProfile(mention.screen_name, originalTweetJson.user.screen_name);
        }
      }
    }

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// 账户档案相关操作
export async function findAccountProfile(username: string): Promise<AccountProfile | undefined> {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM x_account_profiles WHERE username = $1', [
      username
    ]);
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function updateAccountPoints(
  username: string,
  pointsIncrement: number
): Promise<AccountProfile | undefined> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE x_account_profiles 
       SET points = points + $2, 
           updated_at = CURRENT_TIMESTAMP
       WHERE username = $1
       RETURNING *`,
      [username, pointsIncrement]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

// 事件相关操作
export async function createEvent(
  event: Omit<Event, 'id' | 'created_at'>
): Promise<Event | undefined> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO x_events (row_key, level, name, content, target, username)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [event.rowKey, event.level, event.name, event.content, event.target, event.username]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

// 事务操作
export async function executeTransaction(operations: Promise<unknown>[]): Promise<unknown[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = await Promise.all(operations);
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// 更新或创建账户档案
export async function upsertAccountProfile(
  username: string,
  mentionedBy: string | null = null
): Promise<AccountProfile | undefined> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO x_account_profiles (
        username,
        points,
        first_mentioned_by,
        first_mentioned_at
      )
      VALUES ($1, 0, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (username) 
      DO UPDATE SET
        first_mentioned_by = COALESCE(x_account_profiles.first_mentioned_by, EXCLUDED.first_mentioned_by),
        first_mentioned_at = COALESCE(x_account_profiles.first_mentioned_at, EXCLUDED.first_mentioned_at),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [username, mentionedBy]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export default pool;
