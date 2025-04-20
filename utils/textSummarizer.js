const axios = require('axios');

/**
 * Summarizes text for image generation using Cloudflare's LLM
 * Extracts visually descriptive elements from the text
 * 
 * @param {string} text - The text to summarize
 * @param {string} title - Optional title for context
 * @param {string} chapterInfo - Optional chapter information
 * @param {number} maxLength - Maximum length of the summary
 * @returns {Promise<string>} - A promise that resolves to the summarized text
 */
async function summarizeTextForImageGeneration(text, title = '', chapterInfo = '', maxLength = 200) {
  try {
    // Clean up the text first
    const cleanText = text
      .replace(/\\s+/g, ' ')
      .replace(/[\\r\\n]+/g, ' ')
      .trim();
    
    // If text is already short, no need to summarize
    if (cleanText.length <= maxLength) {
      return cleanText;
    }
    
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    
    if (!accountId || !apiToken) {
      console.log('Cloudflare credentials not found, skipping summarization');
      return cleanText.substring(0, maxLength);
    }
    
    // Build context for better summarization
    let contextInfo = '';
    if (title) {
      contextInfo += `Title: "${title}". `;
    }
    if (chapterInfo) {
      contextInfo += `Chapter: "${chapterInfo}". `;
    }
    
    // Use Cloudflare's LLM for summarization
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-2-7b-chat-int8`;
    
    const prompt = `
    You are a visual description expert. Extract the most visually descriptive elements from this text passage.
    Focus on scenes, characters, environments, colors, actions, and visual details that would make a good image.
    Provide a concise description (maximum 75 words) that captures the visual essence.
    Do not include any commentary, just the visual description.
    
    ${contextInfo}
    
    Text passage: "${cleanText.substring(0, 1000)}"
    
    Visual description:`;
    
    console.log('Sending summarization request to Cloudflare AI');
    
    const response = await axios.post(
      url,
      { prompt },
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Extract the summary from the response
    let summary = response.data.trim();
    
    // Remove any quotes that might be in the response
    summary = summary.replace(/^["']|["']$/g, '');
    
    // Ensure it's not too long
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength - 3) + '...';
    }
    
    console.log('Successfully summarized text:', summary);
    return summary;
  } catch (error) {
    console.error('Error summarizing text:', error.message);
    
    if (error.response) {
      console.error('Cloudflare API response error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data ? error.response.data.toString() : 'No data'
      });
    }
    
    // Fallback to the original text if summarization fails
    return text.substring(0, maxLength);
  }
}

// Simple in-memory cache for summarized text
const summaryCache = new Map();

/**
 * Gets a summarized version of text, using cache if available
 * 
 * @param {string} text - The text to summarize
 * @param {string} title - Optional title for context
 * @param {string} chapterInfo - Optional chapter information
 * @param {number} maxLength - Maximum length of the summary
 * @returns {Promise<string>} - A promise that resolves to the summarized text
 */
async function getSummarizedText(text, title = '', chapterInfo = '', maxLength = 200) {
  // Create a cache key from the input parameters
  const cacheKey = `${text.substring(0, 100)}|${title}|${chapterInfo}|${maxLength}`;
  
  // Check if we have a cached result
  if (summaryCache.has(cacheKey)) {
    console.log('Using cached summary');
    return summaryCache.get(cacheKey);
  }
  
  // Generate a new summary
  const summary = await summarizeTextForImageGeneration(text, title, chapterInfo, maxLength);
  
  // Cache the result (limit cache size to 1000 entries)
  if (summaryCache.size >= 1000) {
    // Remove the oldest entry
    const firstKey = summaryCache.keys().next().value;
    summaryCache.delete(firstKey);
  }
  summaryCache.set(cacheKey, summary);
  
  return summary;
}

module.exports = { getSummarizedText };
