/**
 * Scheduled Data Extraction Service
 * 
 * Handles scheduled daily extraction of analytics data from all platforms
 * and appending to Google Sheets.
 */

import cron from 'node-cron';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { extractMavelyData } from './mavelyDataExtraction.js';
import { appendToGoogleSheets } from './googleSheets.js';

interface ScheduledJob {
  userId: string;
  platform: 'MAVELY' | 'AMAZON' | 'SHOPMY';
  spreadsheetId: string;
  sheetName?: string;
  schedule: string; // Cron expression
  enabled: boolean;
}

let supabase: SupabaseClient | null = null;

/**
 * Get Supabase client (singleton)
 */
function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required');
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

/**
 * Run daily data extraction for a user
 */
async function runDailyExtraction(
  userId: string,
  platform: 'MAVELY' | 'AMAZON' | 'SHOPMY',
  spreadsheetId: string,
  sheetName?: string
): Promise<void> {
  console.log(`[Scheduled Job] Running daily extraction for user ${userId} on ${platform}`);
  
  try {
    // Get yesterday's date (full day of data)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    let data: any[] = [];
    
    // Extract data based on platform
    switch (platform) {
      case 'MAVELY':
        const mavelyResult = await extractMavelyData(userId, dateStr, dateStr);
        if (mavelyResult.success && mavelyResult.data) {
          data = mavelyResult.data;
        }
        break;
      
      case 'AMAZON':
        // TODO: Implement Amazon extraction
        console.log(`[Scheduled Job] Amazon extraction not yet implemented`);
        break;
      
      case 'SHOPMY':
        // TODO: Implement ShopMY extraction
        console.log(`[Scheduled Job] ShopMY extraction not yet implemented`);
        break;
    }
    
    // Append to Google Sheets if data was extracted
    if (data.length > 0) {
      const sheetsResult = await appendToGoogleSheets(data, {
        spreadsheetId,
        sheetName: sheetName || `${platform} Analytics`,
      });
      
      if (sheetsResult.success) {
        console.log(`[Scheduled Job] Successfully appended ${data.length} rows to Google Sheets`);
        
        // Update last_synced_at in platform_connections
        const db = getSupabase();
        await db
          .from('platform_connections')
          .update({
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('platform', platform);
      } else {
        console.error(`[Scheduled Job] Failed to append to Google Sheets: ${sheetsResult.error}`);
      }
    } else {
      console.log(`[Scheduled Job] No data extracted for user ${userId} on ${platform}`);
    }
  } catch (error) {
    console.error(`[Scheduled Job] Error running extraction for user ${userId}:`, error);
  }
}

/**
 * Get all scheduled jobs from database
 */
async function getScheduledJobs(): Promise<ScheduledJob[]> {
  const db = getSupabase();
  
  try {
    // Query platform_connections for users with scheduled jobs enabled
    const { data, error } = await db
      .from('platform_connections')
      .select('user_id, platform, metadata')
      .eq('status', 'CONNECTED')
      .not('metadata->scheduled_job', 'is', null);
    
    if (error) {
      console.error('[Scheduled Jobs] Error fetching jobs:', error);
      return [];
    }
    
    const jobs: ScheduledJob[] = [];
    
    for (const connection of data || []) {
      const metadata = connection.metadata as any;
      const scheduledJob = metadata?.scheduled_job;
      
      if (scheduledJob && scheduledJob.enabled) {
        jobs.push({
          userId: connection.user_id,
          platform: connection.platform,
          spreadsheetId: scheduledJob.spreadsheet_id,
          sheetName: scheduledJob.sheet_name,
          schedule: scheduledJob.schedule || '0 2 * * *', // Default: 2 AM daily
          enabled: scheduledJob.enabled,
        });
      }
    }
    
    return jobs;
  } catch (error) {
    console.error('[Scheduled Jobs] Error getting scheduled jobs:', error);
    return [];
  }
}

/**
 * Start the scheduled data extraction job
 * Runs daily at 2 AM by default (configurable per user)
 */
export function startScheduledDataExtraction(): void {
  console.log('[Scheduled Jobs] Starting scheduled data extraction service...');
  
  // Run every day at 2 AM UTC
  cron.schedule('0 2 * * *', async () => {
    console.log('[Scheduled Jobs] Running daily data extraction...');
    
    const jobs = await getScheduledJobs();
    
    if (jobs.length === 0) {
      console.log('[Scheduled Jobs] No scheduled jobs found');
      return;
    }
    
    console.log(`[Scheduled Jobs] Found ${jobs.length} scheduled jobs`);
    
    // Run all jobs (could be parallelized if needed)
    for (const job of jobs) {
      await runDailyExtraction(
        job.userId,
        job.platform,
        job.spreadsheetId,
        job.sheetName
      );
      
      // Small delay between jobs to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    console.log('[Scheduled Jobs] Daily extraction completed');
  });
  
  console.log('[Scheduled Jobs] Scheduled daily extraction at 2 AM UTC');
}

/**
 * Enable scheduled extraction for a user
 */
export async function enableScheduledExtraction(
  userId: string,
  platform: 'MAVELY' | 'AMAZON' | 'SHOPMY',
  spreadsheetId: string,
  sheetName?: string,
  schedule?: string
): Promise<void> {
  const db = getSupabase();
  
  // Get current metadata
  const { data: connection, error: fetchError } = await db
    .from('platform_connections')
    .select('id, metadata')
    .eq('user_id', userId)
    .eq('platform', platform)
    .single();
  
  if (fetchError || !connection) {
    throw new Error(`No ${platform} connection found for user`);
  }
  
  // Update metadata with scheduled job config
  const currentMetadata = (connection.metadata as Record<string, unknown>) || {};
  const updatedMetadata = {
    ...currentMetadata,
    scheduled_job: {
      enabled: true,
      spreadsheet_id: spreadsheetId,
      sheet_name: sheetName,
      schedule: schedule || '0 2 * * *',
      created_at: new Date().toISOString(),
    },
  };
  
  const { error } = await db
    .from('platform_connections')
    .update({
      metadata: updatedMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id);
  
  if (error) {
    throw new Error(`Failed to enable scheduled extraction: ${error.message}`);
  }
  
  console.log(`[Scheduled Jobs] Enabled scheduled extraction for user ${userId} on ${platform}`);
}

/**
 * Disable scheduled extraction for a user
 */
export async function disableScheduledExtraction(
  userId: string,
  platform: 'MAVELY' | 'AMAZON' | 'SHOPMY'
): Promise<void> {
  const db = getSupabase();
  
  const { data: connection, error: fetchError } = await db
    .from('platform_connections')
    .select('id, metadata')
    .eq('user_id', userId)
    .eq('platform', platform)
    .single();
  
  if (fetchError || !connection) {
    throw new Error(`No ${platform} connection found for user`);
  }
  
  const currentMetadata = (connection.metadata as Record<string, unknown>) || {};
  const updatedMetadata = {
    ...currentMetadata,
    scheduled_job: {
      ...(currentMetadata.scheduled_job as Record<string, unknown> || {}),
      enabled: false,
    },
  };
  
  const { error } = await db
    .from('platform_connections')
    .update({
      metadata: updatedMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id);
  
  if (error) {
    throw new Error(`Failed to disable scheduled extraction: ${error.message}`);
  }
  
  console.log(`[Scheduled Jobs] Disabled scheduled extraction for user ${userId} on ${platform}`);
}
