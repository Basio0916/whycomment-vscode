/**
 * Demo script to test context extraction functionality
 * This file will not be included in the final extension package
 */

import * as fs from 'fs';
import * as path from 'path';
import { ContextExtractionService } from './contextExtractionService';
import { ChangeInfo } from './types';

async function runDemo(): Promise<void> {
    console.log('=== WhyComment Context Extraction Demo ===\n');
    
    const service = new ContextExtractionService();
    
    // Test with TypeScript file
    const tsFilePath = path.join(__dirname, '../test-files/sample.ts');
    if (fs.existsSync(tsFilePath)) {
        console.log('Testing TypeScript file context extraction:');
        
        // Simulate a change on line 18 (the result = a + b line)
        const tsChange: ChangeInfo = {
            filePath: tsFilePath,
            lineNumber: 17, // 0-based indexing
            changeType: 'modified',
            content: '        const result = a + b;  // This line could be analyzed for context'
        };
        
        try {
            const contextData = await service.extractSingleContext(tsChange);
            if (contextData) {
                console.log('TypeScript Context Data:');
                console.log(JSON.stringify(contextData, null, 2));
            }
        } catch (error) {
            console.error('Error extracting TypeScript context:', error);
        }
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test with Python file
    const pyFilePath = path.join(__dirname, '../test-files/sample.py');
    if (fs.existsSync(pyFilePath)) {
        console.log('Testing Python file context extraction:');
        
        // Simulate a change on the result = a + b line
        const pyChange: ChangeInfo = {
            filePath: pyFilePath,
            lineNumber: 17, // 0-based indexing
            changeType: 'modified',
            content: '        result = a + b  # This line could be analyzed'
        };
        
        try {
            const contextData = await service.extractSingleContext(pyChange);
            if (contextData) {
                console.log('Python Context Data:');
                console.log(JSON.stringify(contextData, null, 2));
            }
        } catch (error) {
            console.error('Error extracting Python context:', error);
        }
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    console.log('Demo completed! Check the output above for context extraction results.');
}

// Only run if this script is executed directly
if (require.main === module) {
    runDemo().catch(console.error);
}