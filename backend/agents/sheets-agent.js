import { BaseAgent } from './base-agent.js';
import { google } from 'googleapis';

/**
 * GoogleSheetsAgent - Manages approved writes to Google Sheets
 */
export class GoogleSheetsAgent extends BaseAgent {
  constructor(config) {
    super({
      id: 'sheets-agent',
      name: 'Google Sheets Agent',
      role: 'data-sync',
      ...config
    });

    this.sheetsId = config.sheetsId || process.env.GOOGLE_SHEETS_ID;
    this.initializeAuth(config);
  }

  /**
   * Initialize Google Auth
   */
  async initializeAuth(config) {
    const auth = new google.auth.GoogleAuth({
      keyFile: config.googleCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    this.authClient = await auth.getClient();
    this.sheets = google.sheets({ version: 'v4', auth: this.authClient });
    
    console.log('âœ… Google Sheets Agent: Authenticated');
  }

  /**
   * Main execution: process approved write request
   */
  async execute(input) {
    const { writeRequest, approval } = input;

    if (!approval || approval.decision !== 'approve') {
      this.log('warn', 'Write request not approved', { requestId: writeRequest.id });
      return { success: false, reason: 'not_approved' };
    }

    this.setState('running', { requestId: writeRequest.id });
    this.log('info', `Writing to sheet: ${writeRequest.target_sheet}`);

    try {
      let result;

      switch (writeRequest.target_sheet) {
        case 'Full group details':
          result = await this.writeGroupDetails(writeRequest.payload);
          break;
        case "Paul's group inventory":
        case "Jonathan's group inventory":
          result = await this.writeInventory(writeRequest.target_sheet, writeRequest.payload);
          break;
        default:
          // Daily gameplay sheet
          if (writeRequest.target_sheet.includes('Gameplay')) {
            result = await this.writeGameplayLog(writeRequest.target_sheet, writeRequest.payload);
          }
      }

      const response = {
        success: true,
        writeRequest: writeRequest.id,
        approval: approval.id,
        sheetId: this.sheetsId,
        range: result?.updatedRange,
        timestamp: new Date()
      };

      this.setState('completed');
      this.emit('writeComplete', response);

      return response;

    } catch (error) {
      this.handleError(error, { requestId: writeRequest.id });
      throw error;
    }
  }

  /**
   * Write to "Full group details" sheet
   */
  async writeGroupDetails(playerData) {
    const range = 'Full group details!A:G';

    // Check if player exists
    const existing = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetsId,
      range
    });

    const rows = existing.data.values || [];
    const playerIndex = rows.findIndex(row =>
      row[0] === playerData.real_name || row[1] === playerData.in_game_name
    );

    const rowData = [
      playerData.real_name,
      playerData.in_game_name,
      playerData.race,
      playerData.role_type,
      playerData.level,
      playerData.date_joined || new Date().toISOString().split('T')[0]
    ];

    if (playerIndex >= 0) {
      // Update existing
      const updateRange = `Full group details!A${playerIndex + 1}:F${playerIndex + 1}`;
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetsId,
        range: updateRange,
        valueInputOption: 'RAW',
        resource: { values: [rowData] }
      });
      return { updatedRange: updateRange };
    } else {
      // Append new
      const result = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetsId,
        range: 'Full group details!A:F',
        valueInputOption: 'RAW',
        resource: { values: [rowData] }
      });
      return { updatedRange: result.data.updates.updatedRange };
    }
  }

  /**
   * Write to inventory sheets
   */
  async writeInventory(sheetName, inventoryData) {
    const rowData = [
      inventoryData.purchaser,
      inventoryData.item_name,
      inventoryData.amount,
      inventoryData.cost,
      inventoryData.weight || '',
      inventoryData.total_cost,
      inventoryData.remaining || inventoryData.amount,
      inventoryData.notes || ''
    ];

    const result = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.sheetsId,
      range: `${sheetName}!A:H`,
      valueInputOption: 'RAW',
      resource: { values: [rowData] }
    });

    return { updatedRange: result.data.updates.updatedRange };
  }

  /**
   * Write gameplay log (creates new sheet if needed)
   */
  async writeGameplayLog(sheetName, gameplayData) {
    // Check if sheet exists
    const sheetExists = await this.checkSheetExists(sheetName);

    if (!sheetExists) {
      // Create new sheet
      await this.createGameplaySheet(sheetName);
    }

    // Write rows
    const rows = gameplayData.rows.map(row => [
      row.Group || 'Unknown',
      row.Quantity || 1,
      row.Item || '',
      row['Gold Value'] || 0,
      row['Total Value'] || 0,
      row['Distributed To'] || 'Party',
      row['Sold To'] || '',
      row['Lesson Learns'] || '',
      row.Player || '',
      row.Character || '',
      row['Group (Paul\'s group or Jonathan\'s group)'] || 'Unknown'
    ]);

    const result = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.sheetsId,
      range: `${sheetName}!A:K`,
      valueInputOption: 'RAW',
      resource: { values: rows }
    });

    return { updatedRange: result.data.updates.updatedRange };
  }

  /**
   * Check if sheet exists
   */
  async checkSheetExists(sheetName) {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.sheetsId
      });

      return response.data.sheets.some(sheet =>
        sheet.properties.title === sheetName
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Create new gameplay sheet with headers
   */
  async createGameplaySheet(sheetName) {
    // Add new sheet
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.sheetsId,
      resource: {
        requests: [{
          addSheet: {
            properties: {
              title: sheetName
            }
          }
        }]
      }
    });

    // Add headers
    const headers = [
      'Group',
      'Quantity',
      'Item',
      'Gold Value',
      'Total Value',
      'Distributed To',
      'Sold To',
      'Lesson Learns',
      'Player',
      'Character',
      'Group (Paul\'s group or Jonathan\'s group)'
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.sheetsId,
      range: `${sheetName}!A1:K1`,
      valueInputOption: 'RAW',
      resource: { values: [headers] }
    });

    console.log(`âœ… Created gameplay sheet: ${sheetName}`);
  }

  /**
   * Create write request (to be approved)
   */
  async createWriteRequest(targetSheet, payload, createdBy) {
    const writeRequest = {
      id: `wr_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      target_sheet: targetSheet,
      payload,
      created_by: createdBy,
      created_ts: new Date(),
      approved_by_dm: null,
      approval_ts: null,
      status: 'pending'
    };

    this.emit('writeRequestCreated', writeRequest);
    return writeRequest;
  }
}
