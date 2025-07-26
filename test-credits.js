// Test script to check credit deduction

async function testCreditDeduction() {
  console.log('=== CREDIT DEDUCTION TEST ===');
  
  // Step 1: Check current credits
  console.log('1. Checking current credits...');
  const creditsResponse = await fetch('/api/user/credits');
  const creditsData = await creditsResponse.json();
  console.log('Current credits:', creditsData.credits);
  
  // Step 2: Make a chat request
  console.log('2. Making a chat request...');
  const chatResponse = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: 'Hello, this is a test message for credit deduction.' }
      ],
      files: {},
      promptId: 'default',
      contextOptimization: false,
      conversationId: 'test-' + Date.now(),
      selectedModel: 'deepseek/deepseek-chat-v3-0324:free'
    })
  });
  
  if (!chatResponse.ok) {
    console.error('Chat request failed:', chatResponse.status, await chatResponse.text());
    return;
  }
  
  console.log('Chat request successful');
  
  // Step 3: Check credits again
  console.log('3. Checking credits after request...');
  const creditsAfterResponse = await fetch('/api/user/credits');
  const creditsAfterData = await creditsAfterResponse.json();
  console.log('Credits after request:', creditsAfterData.credits);
  
  // Step 4: Calculate difference
  const difference = creditsData.credits - creditsAfterData.credits;
  console.log('Credits deducted:', difference);
  console.log('=== TEST COMPLETE ===');
}

// Run the test
testCreditDeduction().catch(console.error); 