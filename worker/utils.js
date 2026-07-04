/**
 * Calculates the backoff delay in seconds based on the retry policy.
 */
function calculateBackoff(policy, attemptNumber) {
  const base = policy.base_delay_seconds || 60;
  let delay = base;
  
  if (policy.strategy === 'linear') {
    delay = base * attemptNumber;
  } else if (policy.strategy === 'exponential') {
    // attemptNumber is 1-indexed, so first retry (attempt 2) uses base * 2^1
    delay = base * Math.pow(2, attemptNumber - 1); 
  }
  
  // Cap at max_delay_seconds
  return Math.min(delay, policy.max_delay_seconds || 3600);
}

module.exports = {
  calculateBackoff
};
