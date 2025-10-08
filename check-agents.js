// check-agents.js
import { config } from './config.js';

const API_URL = `http://localhost:${config.port}`;

async function checkAgents() {
  const health = await fetch(`${API_URL}/api/agents/health`).then(r => r.json());
  
  console.log('Agent Status:');
  Object.entries(health).forEach(([name, status]) => {
    console.log(`  ${name}: ${status.state} (${status.id})`);
  });
  
  if (!health.sheets) {
    console.log('\nâš ï¸  Sheets agent NOT initialized!');
    console.log('Check your config.js has:');
    console.log('  - googleApplicationCredentials');
    console.log('  - googleSheetsId');
  } else {
    console.log('\nâœ… Sheets agent is initialized');
  }
}

checkAgents();
