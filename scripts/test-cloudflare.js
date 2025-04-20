require('dotenv').config();
const axios = require('axios');

async function testCloudflareCredentials() {
  try {
    console.log('Testing Cloudflare API credentials...');

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      console.error('❌ Error: Cloudflare credentials not found in environment variables');
      console.log('Please make sure CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are set in your .env file');
      return;
    }

    console.log(`Account ID: ${accountId.substring(0, 3)}...${accountId.substring(accountId.length - 3)}`);
    console.log(`API Token: ${apiToken.substring(0, 3)}...${apiToken.substring(apiToken.length - 3)}`);

    // Test the token verification endpoint
    const verifyUrl = 'https://api.cloudflare.com/client/v4/user/tokens/verify';
    const verifyResponse = await axios.get(verifyUrl, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Token verification response:', verifyResponse.data);

    if (verifyResponse.data.success) {
      console.log('✅ API token is valid!');

      // Now test the image generation model
      console.log('\nTesting image generation model...');
      try {
        const imageUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`;
        console.log(`Making request to: ${imageUrl}`);

        const imageResponse = await axios.post(imageUrl, {
          prompt: "A beautiful landscape with mountains and a lake",
          num_steps: 10, // Lower for testing
          width: 512,
          height: 512
        }, {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        });

        console.log('✅ Successfully generated test image!');
        console.log(`Image size: ${imageResponse.data.length} bytes`);
        console.log('Image generation is working correctly');
      } catch (imageError) {
        console.error('❌ Failed to generate test image:');
        if (imageError.response) {
          try {
            // Try to parse the error data
            let errorData = imageError.response.data;
            if (errorData instanceof Buffer) {
              errorData = errorData.toString('utf8');
              try {
                const jsonData = JSON.parse(errorData);
                errorData = JSON.stringify(jsonData, null, 2);
              } catch (e) {
                // Not JSON, use as is
              }
            }
            console.error(`Status: ${imageError.response.status}`);
            console.error('Error:', errorData);
          } catch (e) {
            console.error(`Status: ${imageError.response.status}`);
            console.error('Error: Could not parse error data');
          }
        } else {
          console.error(imageError.message);
        }
      }
    } else {
      console.error('❌ API token is invalid:', verifyResponse.data.errors);
    }
  } catch (error) {
    console.error('❌ Error testing Cloudflare credentials:');

    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testCloudflareCredentials();
