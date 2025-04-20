const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Generate an image using Cloudflare Workers AI
 * @param {string} prompt - The text prompt for image generation
 * @param {string} style - The style of the image (default, anime, realistic, artistic, fantasy)
 * @returns {Promise<Buffer>} - A promise that resolves to the image buffer
 */
async function generateImageWithCloudflare(prompt, style = 'default') {
  try {
    console.log(`Generating image with Cloudflare AI: "${prompt}" (${style} style)`);

    // Get Cloudflare credentials from environment variables
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      throw new Error('Cloudflare credentials not found in environment variables');
    }

    // Limit prompt length to avoid issues
    const maxPromptLength = 500; // Cloudflare has limits on prompt length
    let basePrompt = prompt;

    // Truncate if needed
    if (basePrompt.length > maxPromptLength) {
      console.log(`Prompt too long (${basePrompt.length} chars), truncating to ${maxPromptLength} chars`);
      basePrompt = basePrompt.substring(0, maxPromptLength) + '...';
    }

    // Analyze the prompt to extract scene information
    const isSceneFrom = basePrompt.includes('Scene from');

    // Extract title and scene description for better prompting
    let title = '';
    let sceneDescription = basePrompt;

    if (isSceneFrom) {
      // Extract the title if it exists
      const titleMatch = basePrompt.match(/Scene from "([^"]+)"/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1];
      }

      // Extract the scene description
      const descriptionMatch = basePrompt.match(/:\s*(.+)$/i);
      if (descriptionMatch && descriptionMatch[1]) {
        sceneDescription = descriptionMatch[1];
      }
    }

    // Adjust prompt based on style with more context-aware modifiers
    let adjustedPrompt;
    switch (style) {
      case 'anime':
        adjustedPrompt = `${sceneDescription}, anime style illustration, detailed anime artwork, vibrant colors, high quality anime illustration`;
        if (title) {
          adjustedPrompt = `${adjustedPrompt}, from anime "${title}"`;
        }
        break;

      case 'realistic':
        adjustedPrompt = `${sceneDescription}, realistic detailed illustration, photorealistic, high resolution photography, cinematic lighting`;
        if (title) {
          adjustedPrompt = `${adjustedPrompt}, from the novel "${title}"`;
        }
        break;

      case 'artistic':
        adjustedPrompt = `${sceneDescription}, artistic digital painting, vibrant colors, detailed artwork, professional illustration`;
        if (title) {
          adjustedPrompt = `${adjustedPrompt}, inspired by "${title}"`;
        }
        break;

      case 'fantasy':
        adjustedPrompt = `${sceneDescription}, fantasy art style, magical atmosphere, ethereal lighting, detailed fantasy scene, epic fantasy illustration`;
        if (title) {
          adjustedPrompt = `${adjustedPrompt}, from fantasy world of "${title}"`;
        }
        break;

      default:
        adjustedPrompt = `${sceneDescription}, detailed illustration, high quality artwork, professional digital art`;
        if (title) {
          adjustedPrompt = `${adjustedPrompt}, from "${title}"`;
        }
        break;
    }

    // Final check on prompt length
    if (adjustedPrompt.length > 1000) { // Absolute maximum
      console.log(`Final prompt too long (${adjustedPrompt.length} chars), truncating`);
      adjustedPrompt = adjustedPrompt.substring(0, 1000);
    }

    // Select the appropriate Cloudflare model based on style
    let model = '@cf/stabilityai/stable-diffusion-xl-base-1.0';

    // Cloudflare Workers AI API endpoint
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

    // Request configuration
    const config = {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer'
    };

    // Request body
    const data = {
      prompt: adjustedPrompt,
      num_steps: 20, // Maximum allowed by Cloudflare
      width: 512,  // Standard size, less likely to cause issues
      height: 512  // Square aspect ratio for better compatibility
    };

    console.log(`Making Cloudflare API request to ${url} with prompt length: ${adjustedPrompt.length}`);
    console.log('Request parameters:', { ...data, prompt: `${adjustedPrompt.substring(0, 30)}...` });

    // Make the API request
    const response = await axios.post(url, data, config);

    console.log('Cloudflare API response received:', {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      dataSize: response.data ? response.data.length : 0
    });

    // Return the image buffer
    return response.data;
  } catch (error) {
    console.error('Error generating image with Cloudflare AI:', error.message);

    if (error.response) {
      let errorData = 'No data';

      // Try to parse the error data if it's a buffer
      if (error.response.data) {
        try {
          if (error.response.data instanceof Buffer) {
            errorData = error.response.data.toString('utf8');
            // Try to parse as JSON for better readability
            try {
              const jsonData = JSON.parse(errorData);
              errorData = JSON.stringify(jsonData, null, 2);
            } catch (e) {
              // Not JSON, use as is
            }
          } else {
            errorData = error.response.data.toString();
          }
        } catch (e) {
          errorData = 'Error parsing response data: ' + e.message;
        }
      }

      console.error('Cloudflare API response error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: errorData
      });

      // Create a more informative error message
      let enhancedError;
      if (error.response.status === 400) {
        enhancedError = new Error(`Cloudflare API Bad Request (400): ${errorData}`);
      } else if (error.response.status === 401) {
        enhancedError = new Error('Cloudflare API Authentication Error (401): Please check your account ID and API token');
      } else if (error.response.status === 429) {
        enhancedError = new Error('Cloudflare API Rate Limit Exceeded (429): Please try again later');
      } else {
        enhancedError = new Error(`Cloudflare API Error (${error.response.status}): ${errorData}`);
      }

      enhancedError.originalError = error;
      throw enhancedError;
    }

    throw error;
  }
}

module.exports = { generateImageWithCloudflare };
