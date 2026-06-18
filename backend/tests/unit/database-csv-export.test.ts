import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DatabaseTableService } from '../../src/services/database/database-table.service';
import { AppError } from '../../src/utils/errors';

describe('Database CSV Export Streaming Core', () => {
  let tableService: DatabaseTableService;
  let mockClient: any;

  beforeEach(() => {
    tableService = DatabaseTableService.getInstance();

    // Mock a standard database client state
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    // Intercept getPool().connect() to return our mock transaction handler client
    vi.spyOn(tableService as any, 'getPool').mockReturnValue({
      connect: vi.fn().mockResolvedValue(mockClient),
    });
  });

  it('successfully streams database table records to a CSV string payload block', async () => {
    // 1. Mock the initial information_schema columns inspection result mapping
    mockClient.query.mockResolvedValueOnce({
      rows: [
        { column_name: 'id' },
        { column_name: 'email' },
        { column_name: 'profile_status' }
      ]
    });

    // 2. Mock the actual data records chunks extraction rows
    mockClient.query.mockResolvedValueOnce({
      rows: [
        { id: 'usr-100', email: 'viny@example.com', profile_status: 'Active' },
        { id: 'usr-200', email: 'sergeant@forge.io', profile_status: 'On Duty, Captain' }
      ]
    });

    // An empty chunk array on the next index slice breaks the paging extractor loop cleanly
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    // Mock a clean, writable stream buffer capture class replicating the Express Response pipeline
    let writtenBuffer = '';
    const mockExpressResponse = {
      write: (chunk: string) => {
        writtenBuffer += chunk;
        return true;
      }
    } as any;

    // 3. Execute the isolated database stream pipeline engine pass
    await tableService.streamTableToCsv('public', 'users', mockExpressResponse);

    // 4. Assert the structural integrity of the CSV streaming payload output
    const lines = writtenBuffer.trim().split('\n');
    
    // Assert Headers Row are explicitly mapped out in correct ordinal position
    expect(lines[0]).toBe('id,email,profile_status');

    // Assert Records Rows values are cleanly extracted, ordered, and formatted
    expect(lines[1]).toBe('usr-100,viny@example.com,Active');
    expect(lines[2]).toBe('usr-200,sergeant@forge.io,"On Duty, Captain"'); // Clean RFC 4180 parsing wrap!
    
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('throws a controlled 404 AppError if the targeted export table does not exist', async () => {
    // Return an empty array from information_schema columns inspection
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    const mockExpressResponse = { write: vi.fn() } as any;

    await expect(
      tableService.streamTableToCsv('public', 'non_existent_table', mockExpressResponse)
    ).rejects.toThrow(AppError);

    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('writes a physical simulated CSV copy directly to the workspace folder', async () => {
    const fs = await import('fs');
    
    mockClient.query.mockResolvedValueOnce({
      rows: [{ column_name: 'id' }, { column_name: 'name' }, { column_name: 'role' }]
    });
    mockClient.query.mockResolvedValueOnce({
      rows: [
        { id: '1', name: 'Vinay (Captain)', role: 'Commander' },
        { id: '2', name: 'Sergeant', role: 'Watch Officer' }
      ]
    });
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    // Open an actual physical file stream right in your backend folder
    const diskStream = fs.createWriteStream('./simulated_database_export.csv');

    // Execute the streaming pipeline
    await tableService.streamTableToCsv('public', 'users', diskStream as any);
    
    // Explicitly wait for the file handle to finish flushing completely to disk
    await new Promise<void>((resolve, reject) => {
      diskStream.on('finish', () => resolve());
      diskStream.on('error', (err) => reject(err));
      diskStream.end();
    });

    // Verify the file was written successfully
    const fileExists = fs.existsSync('./simulated_database_export.csv');
    expect(fileExists).toBe(true);
  });
});