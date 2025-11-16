// create-users.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { config } from './config.js';

async function createUsers() {
  await mongoose.connect(config.mongodbUri);

  const userSchema = new mongoose.Schema({
    id: String,
    username: String,
    password: String,
    role: String,
    player_id: String,
    created_at: Date
  });

  const User = mongoose.model('User', userSchema);

  // Create admin
  const adminPassword = await bcrypt.hash('admin123', 10);
  await User.create({
    id: 'user_admin',
    username: 'admin',
    password: adminPassword,
    role: 'admin',
    created_at: new Date()
  });

  // Create regular user
  const userPassword = await bcrypt.hash('user123', 10);
  await User.create({
    id: 'user_001',
    username: 'user1',
    password: userPassword,
    role: 'user',
    player_id: null, // Link to player later
    created_at: new Date()
  });

  console.log('✅ Users created!');
  process.exit(0);
}

createUsers();