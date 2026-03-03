import pkg from '@slack/web-api';
const { WebClient } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function getAllUsers() {
  try {
    console.log('Fetching all Slack users...\n');
    
    const result = await client.users.list();
    
    if (!result.ok) {
      console.error('Error fetching users:', result.error);
      return;
    }
    
    const users = result.members
      .filter(user => !user.is_bot && !user.deleted && user.id !== 'USLACKBOT')
      .map(user => ({
        id: user.id,
        name: user.name,
        real_name: user.real_name || user.name,
        display_name: user.profile?.display_name || user.real_name || user.name
      }))
      .sort((a, b) => a.real_name.localeCompare(b.real_name));
    
    console.log('=== All Slack Users ===\n');
    console.log('ID\t\t\tReal Name\t\tDisplay Name\t\tUsername');
    console.log('─'.repeat(100));
    
    users.forEach(user => {
      console.log(`${user.id}\t${user.real_name}\t\t${user.display_name}\t\t${user.name}`);
    });
    
    console.log('\n=== ClickUp Username Mapping Suggestions ===\n');
    
    const clickupUsers = [
      'Devarapalli Deepthi',
      'Eric Samuel',
      'Harish Kakaraparthi',
      'Pavan Balla',
      'Phani kumar',
      'Pranati Manthena',
      'Sai Deepthi Molugari',
      'Vyshnavi Devi'
    ];
    
    console.log('ClickUp Username → Suggested Slack User\n');
    
    clickupUsers.forEach(clickupName => {
      const nameParts = clickupName.toLowerCase().split(' ');
      const match = users.find(user => {
        const userNameLower = user.real_name.toLowerCase();
        return nameParts.some(part => userNameLower.includes(part));
      });
      
      if (match) {
        console.log(`"${clickupName}" → ${match.id} (${match.real_name})`);
      } else {
        console.log(`"${clickupName}" → NOT FOUND - Please map manually`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

getAllUsers();
