import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ContextExtractionService, ContextData } from '../ContextExtractionService';
import { DiffLine } from '../GitDiffService';

suite('ContextExtractionService Test Suite', () => {
    let contextService: ContextExtractionService;
    let testFilesDir: string;

    setup(async () => {
        contextService = new ContextExtractionService();
        testFilesDir = path.join(__dirname, '..', '..', 'test-files');
        
        // Create test files directory if it doesn't exist
        if (!fs.existsSync(testFilesDir)) {
            fs.mkdirSync(testFilesDir, { recursive: true });
        }
    });

    teardown(async () => {
        // Clean up test files
        if (fs.existsSync(testFilesDir)) {
            const files = fs.readdirSync(testFilesDir);
            for (const file of files) {
                fs.unlinkSync(path.join(testFilesDir, file));
            }
            fs.rmdirSync(testFilesDir);
        }
    });

    test('should extract context for TypeScript file', async () => {
        const testContent = `// Test file header
export class TestClass {
    private value: number = 0;
    
    public getValue(): number {
        return this.value;
    }
    
    public setValue(newValue: number): void {
        this.value = newValue; // This line will be changed
        console.log('Value set to:', this.value);
    }
}

function helperFunction() {
    return 'helper';
}`;

        const testFilePath = path.join(testFilesDir, 'test.ts');
        fs.writeFileSync(testFilePath, testContent);

        const changes: DiffLine[] = [
            {
                lineNumber: 9,
                content: '        this.value = newValue; // This line was changed',
                type: 'modified'
            }
        ];

        const contextData = await contextService.extractContext(testFilePath, changes);
        
        assert.strictEqual(contextData.length, 1);
        const context = contextData[0];
        
        assert.strictEqual(context.changeType, 'modified');
        assert.strictEqual(context.lineNumber, 9);
        assert.strictEqual(context.content, '        this.value = newValue; // This line was changed');
        assert.strictEqual(context.functionName, 'setValue');
        assert.strictEqual(context.isComment, false);
        
        // Check context before (should include lines before the change)
        assert.ok(context.contextBefore.length > 0);
        assert.ok(context.contextBefore.some(line => line.includes('public setValue')));
        
        // Check context after (should include lines after the change)
        assert.ok(context.contextAfter.length > 0);
        assert.ok(context.contextAfter.some(line => line.includes('console.log')));
    });

    test('should extract context for Python file', async () => {
        const testContent = `# Test Python file
class TestClass:
    def __init__(self):
        self.value = 0
    
    def get_value(self):
        return self.value
    
    def set_value(self, new_value):
        self.value = new_value  # This will be changed
        print(f"Value set to: {self.value}")

def helper_function():
    return "helper"`;

        const testFilePath = path.join(testFilesDir, 'test.py');
        fs.writeFileSync(testFilePath, testContent);

        const changes: DiffLine[] = [
            {
                lineNumber: 10,
                content: '        self.value = new_value  # This was changed',
                type: 'modified'
            }
        ];

        const contextData = await contextService.extractContext(testFilePath, changes);
        
        assert.strictEqual(contextData.length, 1);
        const context = contextData[0];
        
        assert.strictEqual(context.changeType, 'modified');
        assert.strictEqual(context.lineNumber, 10);
        assert.strictEqual(context.functionName, 'set_value');
        assert.strictEqual(context.isComment, false);
        
        // Verify context extraction
        assert.ok(context.contextBefore.length > 0);
        assert.ok(context.contextAfter.length > 0);
    });

    test('should extract context for Java file', async () => {
        const testContent = `// Test Java file
public class TestClass {
    private int value = 0;
    
    public int getValue() {
        return value;
    }
    
    public void setValue(int newValue) {
        this.value = newValue; // This will be changed
        System.out.println("Value set to: " + this.value);
    }
}`;

        const testFilePath = path.join(testFilesDir, 'test.java');
        fs.writeFileSync(testFilePath, testContent);

        const changes: DiffLine[] = [
            {
                lineNumber: 10,
                content: '        this.value = newValue; // This was changed',
                type: 'modified'
            }
        ];

        const contextData = await contextService.extractContext(testFilePath, changes);
        
        assert.strictEqual(contextData.length, 1);
        const context = contextData[0];
        
        assert.strictEqual(context.changeType, 'modified');
        assert.strictEqual(context.lineNumber, 10);
        assert.strictEqual(context.functionName, 'setValue');
        assert.strictEqual(context.isComment, false);
    });

    test('should handle comment lines correctly', async () => {
        const testContent = `// This is a comment
function testFunction() {
    // This comment will be changed
    console.log('test');
}`;

        const testFilePath = path.join(testFilesDir, 'test-comments.ts');
        fs.writeFileSync(testFilePath, testContent);

        const changes: DiffLine[] = [
            {
                lineNumber: 3,
                content: '    // This comment was updated',
                type: 'modified'
            }
        ];

        const contextData = await contextService.extractContext(testFilePath, changes);
        
        assert.strictEqual(contextData.length, 1);
        const context = contextData[0];
        
        assert.strictEqual(context.isComment, true);
        assert.strictEqual(context.functionName, 'testFunction');
    });

    test('should handle file boundaries correctly', async () => {
        const testContent = `function shortFile() {
    return 'short';
}`;

        const testFilePath = path.join(testFilesDir, 'short.ts');
        fs.writeFileSync(testFilePath, testContent);

        const changes: DiffLine[] = [
            {
                lineNumber: 2,
                content: "    return 'modified';",
                type: 'modified'
            }
        ];

        const contextData = await contextService.extractContext(testFilePath, changes);
        
        assert.strictEqual(contextData.length, 1);
        const context = contextData[0];
        
        // Should handle file boundaries without errors
        assert.ok(context.contextBefore.length <= 2); // Limited by file start
        assert.ok(context.contextAfter.length <= 1);  // Limited by file end
        assert.strictEqual(context.functionName, 'shortFile');
    });

    test('should handle added lines', async () => {
        const testContent = `function testFunction() {
    console.log('existing');
    // New line will be added here
}`;

        const testFilePath = path.join(testFilesDir, 'test-added.ts');
        fs.writeFileSync(testFilePath, testContent);

        const changes: DiffLine[] = [
            {
                lineNumber: 3,
                content: '    console.log("new line");',
                type: 'added'
            }
        ];

        const contextData = await contextService.extractContext(testFilePath, changes);
        
        assert.strictEqual(contextData.length, 1);
        const context = contextData[0];
        
        assert.strictEqual(context.changeType, 'added');
        assert.strictEqual(context.functionName, 'testFunction');
        assert.strictEqual(context.isComment, false);
    });

    test('should handle deleted lines', async () => {
        const changes: DiffLine[] = [
            {
                lineNumber: 5,
                content: '    // This line was deleted',
                type: 'deleted'
            }
        ];

        const testFilePath = path.join(testFilesDir, 'dummy.ts');
        fs.writeFileSync(testFilePath, 'function dummy() {}'); // Minimal file

        const contextData = await contextService.extractContext(testFilePath, changes);
        
        assert.strictEqual(contextData.length, 1);
        const context = contextData[0];
        
        assert.strictEqual(context.changeType, 'deleted');
        assert.strictEqual(context.contextBefore.length, 0); // No context for deleted lines
        assert.strictEqual(context.contextAfter.length, 0);
        assert.strictEqual(context.isComment, true);
    });

    test('should handle multiple changes in same file', async () => {
        const testContent = `function multipleChanges() {
    let a = 1; // This will change
    let b = 2;
    let c = 3; // This will also change
    return a + b + c;
}`;

        const testFilePath = path.join(testFilesDir, 'multiple.ts');
        fs.writeFileSync(testFilePath, testContent);

        const changes: DiffLine[] = [
            {
                lineNumber: 2,
                content: '    let a = 10; // Changed value',
                type: 'modified'
            },
            {
                lineNumber: 4,
                content: '    let c = 30; // Changed value',
                type: 'modified'
            }
        ];

        const contextData = await contextService.extractContext(testFilePath, changes);
        
        assert.strictEqual(contextData.length, 2);
        
        // Both changes should be in the same function
        assert.strictEqual(contextData[0].functionName, 'multipleChanges');
        assert.strictEqual(contextData[1].functionName, 'multipleChanges');
        
        // Both should be non-comment lines
        assert.strictEqual(contextData[0].isComment, false);
        assert.strictEqual(contextData[1].isComment, false);
    });

    test('should handle unsupported file types gracefully', async () => {
        const testContent = `Some text file
with multiple lines
that will be changed`;

        const testFilePath = path.join(testFilesDir, 'test.txt');
        fs.writeFileSync(testFilePath, testContent);

        const changes: DiffLine[] = [
            {
                lineNumber: 2,
                content: 'with modified lines',
                type: 'modified'
            }
        ];

        const contextData = await contextService.extractContext(testFilePath, changes);
        
        assert.strictEqual(contextData.length, 1);
        const context = contextData[0];
        
        // Should still extract context but no function detection
        assert.strictEqual(context.functionName, undefined);
        assert.strictEqual(context.className, undefined);
        assert.strictEqual(context.isComment, false);
        assert.ok(context.contextBefore.length > 0);
        assert.ok(context.contextAfter.length > 0);
    });

    test('should throw error for non-existent file', async () => {
        const changes: DiffLine[] = [
            { lineNumber: 1, content: 'test', type: 'added' }
        ];

        try {
            await contextService.extractContext('/non/existent/file.ts', changes);
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('File not found'));
        }
    });
});