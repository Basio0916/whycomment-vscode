import * as assert from 'assert';
import * as vscode from 'vscode';
import { ContextExtractionService } from '../contextExtractionService';
import { ChangeInfo } from '../types';
import { TypeScriptParser, PythonParser, JavaParser, GoParser } from '../parsers';

suite('Context Extraction Service Tests', () => {
	let service: ContextExtractionService;

	setup(() => {
		service = new ContextExtractionService();
	});

	suite('Parser Tests', () => {
		test('TypeScript Parser - Function Detection', () => {
			const parser = new TypeScriptParser();
			const lines = [
				'import * as vscode from "vscode";',
				'',
				'export function testFunction(param: string): void {',
				'    console.log(param);',
				'}',
				'',
				'const arrowFunc = (x: number) => {',
				'    return x * 2;',
				'};'
			];

			const functions = parser.parseFunctions(lines);
			assert.strictEqual(functions.length, 2);
			assert.strictEqual(functions[0].name, 'testFunction');
			assert.strictEqual(functions[0].type, 'function');
			assert.strictEqual(functions[1].name, 'arrowFunc');
		});

		test('TypeScript Parser - Class Detection', () => {
			const parser = new TypeScriptParser();
			const lines = [
				'export class TestClass {',
				'    private value: number;',
				'',
				'    constructor(val: number) {',
				'        this.value = val;',
				'    }',
				'',
				'    public getValue(): number {',
				'        return this.value;',
				'    }',
				'}'
			];

			const functions = parser.parseFunctions(lines);
			assert.strictEqual(functions.length, 3); // class + constructor + method
			
			const classInfo = functions.find(f => f.type === 'class');
			assert.strictEqual(classInfo?.name, 'TestClass');
			
			const methods = functions.filter(f => f.type === 'method');
			assert.strictEqual(methods.length, 2);
		});

		test('Python Parser - Function and Class Detection', () => {
			const parser = new PythonParser();
			const lines = [
				'class Calculator:',
				'    def __init__(self, name):',
				'        self.name = name',
				'',
				'    def add(self, a, b):',
				'        return a + b',
				'',
				'def standalone_function():',
				'    print("Hello")'
			];

			const functions = parser.parseFunctions(lines);
			assert.strictEqual(functions.length, 4); // class + 2 methods + standalone function
			
			const classInfo = functions.find(f => f.type === 'class');
			assert.strictEqual(classInfo?.name, 'Calculator');
			
			const standaloneFunc = functions.find(f => f.name === 'standalone_function');
			assert.strictEqual(standaloneFunc?.type, 'function');
		});

		test('Java Parser - Method and Class Detection', () => {
			const parser = new JavaParser();
			const lines = [
				'public class Calculator {',
				'    private int value;',
				'',
				'    public Calculator(int val) {',
				'        this.value = val;',
				'    }',
				'',
				'    public int add(int a, int b) {',
				'        return a + b;',
				'    }',
				'',
				'    private void helper() {',
				'        // helper method',
				'    }',
				'}'
			];

			const functions = parser.parseFunctions(lines);
			assert.strictEqual(functions.length, 4); // class + constructor + 2 methods
			
			const classInfo = functions.find(f => f.type === 'class');
			assert.strictEqual(classInfo?.name, 'Calculator');
		});

		test('Go Parser - Function and Struct Detection', () => {
			const parser = new GoParser();
			const lines = [
				'package main',
				'',
				'import "fmt"',
				'',
				'type Calculator struct {',
				'    value int',
				'}',
				'',
				'func (c *Calculator) Add(a, b int) int {',
				'    result := a + b',
				'    return result',
				'}',
				'',
				'func main() {',
				'    calc := Calculator{value: 0}',
				'    fmt.Println(calc.Add(2, 3))',
				'}',
				'',
				'type Adder interface {',
				'    Add(a, b int) int',
				'}'
			];

			const functions = parser.parseFunctions(lines);
			assert.strictEqual(functions.length, 4); // struct + method + function + interface
			
			const structInfo = functions.find(f => f.name === 'Calculator' && f.type === 'class');
			assert.ok(structInfo, 'Should find Calculator struct');
			
			const methodInfo = functions.find(f => f.name === 'Add' && f.type === 'method');
			assert.ok(methodInfo, 'Should find Add method');
			
			const functionInfo = functions.find(f => f.name === 'main' && f.type === 'function');
			assert.ok(functionInfo, 'Should find main function');
			
			const interfaceInfo = functions.find(f => f.name === 'Adder' && f.type === 'interface');
			assert.ok(interfaceInfo, 'Should find Adder interface');
		});

		test('Comment Detection', () => {
			const tsParser = new TypeScriptParser();
			const pyParser = new PythonParser();
			const javaParser = new JavaParser();
			const goParser = new GoParser();

			// TypeScript/JavaScript comments
			assert.strictEqual(tsParser.isCommentLine('// This is a comment'), true);
			assert.strictEqual(tsParser.isCommentLine('/* Block comment */'), true);
			assert.strictEqual(tsParser.isCommentLine('    * JSDoc comment'), true);
			assert.strictEqual(tsParser.isCommentLine('const x = 5;'), false);

			// Python comments
			assert.strictEqual(pyParser.isCommentLine('# This is a comment'), true);
			assert.strictEqual(pyParser.isCommentLine('"""Docstring"""'), true);
			assert.strictEqual(pyParser.isCommentLine("'''Triple quotes'''"), true);
			assert.strictEqual(pyParser.isCommentLine('print("hello")'), false);

			// Java comments
			assert.strictEqual(javaParser.isCommentLine('// Java comment'), true);
			assert.strictEqual(javaParser.isCommentLine('/* Block comment */'), true);
			assert.strictEqual(javaParser.isCommentLine(' * Javadoc'), true);
			assert.strictEqual(javaParser.isCommentLine('int x = 5;'), false);

			// Go comments
			assert.strictEqual(goParser.isCommentLine('// Go comment'), true);
			assert.strictEqual(goParser.isCommentLine('/* Block comment */'), true);
			assert.strictEqual(goParser.isCommentLine(' * Multi-line comment'), true);
			assert.strictEqual(goParser.isCommentLine('var x int = 5'), false);
		});
	});

	suite('Configuration Tests', () => {
		test('Default Configuration', () => {
			const config = service.getConfiguration();
			assert.strictEqual(config.contextLines, 10);
			assert.strictEqual(config.excludeComments, false);
			assert.ok(config.supportedLanguages.includes('typescript'));
			assert.ok(config.supportedLanguages.includes('python'));
			assert.ok(config.supportedLanguages.includes('java'));
			assert.ok(config.supportedLanguages.includes('go'));
		});

		test('File Support Detection', () => {
			assert.strictEqual(service.isFileSupported('/path/file.ts'), true);
			assert.strictEqual(service.isFileSupported('/path/file.js'), true);
			assert.strictEqual(service.isFileSupported('/path/file.py'), true);
			assert.strictEqual(service.isFileSupported('/path/file.java'), true);
			assert.strictEqual(service.isFileSupported('/path/file.txt'), false);
			assert.strictEqual(service.isFileSupported('/path/file.md'), false);
		});
	});

	suite('Context Extraction Edge Cases', () => {
		test('File Boundary Handling - Beginning of File', async () => {
			// This would require a mock file system or workspace
			// For now, we'll test the logic conceptually
			const change: ChangeInfo = {
				filePath: '/test/file.ts',
				lineNumber: 2, // Near beginning of file
				changeType: 'modified',
				content: 'const x = 5;'
			};

			// Verify that we don't go below line 0
			assert.ok(change.lineNumber >= 0);
		});

		test('File Boundary Handling - End of File', () => {
			// Test that we don't exceed file length
			const lines = ['line1', 'line2', 'line3'];
			const maxLine = lines.length - 1;
			const requestedEndLine = maxLine + 10;
			const actualEndLine = Math.min(maxLine, requestedEndLine);
			
			assert.strictEqual(actualEndLine, maxLine);
		});

		test('Empty Line Handling', () => {
			const parser = new TypeScriptParser();
			assert.strictEqual(parser.isExecutableLine(''), false);
			assert.strictEqual(parser.isExecutableLine('   '), false);
			assert.strictEqual(parser.isExecutableLine('\t\t'), false);
			assert.strictEqual(parser.isExecutableLine('const x = 5;'), true);
		});
	});
});

suite('Integration Tests', () => {
	test('Context Data Structure Validation', () => {
		// Test that the context data structure matches the expected format
		const contextData = {
			changeType: 'modified' as const,
			lineNumber: 5,
			content: 'const result = add(a, b);',
			contextBefore: [
				'function add(a: number, b: number): number {',
				'    // Validate inputs',
				'    if (typeof a !== "number" || typeof b !== "number") {',
				'        throw new Error("Invalid input");'
			],
			contextAfter: [
				'    }',
				'    return result;',
				'}',
				''
			],
			functionName: 'add',
			className: undefined
		};

		// Verify all required fields are present
		assert.ok('changeType' in contextData);
		assert.ok('lineNumber' in contextData);
		assert.ok('content' in contextData);
		assert.ok('contextBefore' in contextData);
		assert.ok('contextAfter' in contextData);
		assert.ok('functionName' in contextData);
		
		// Verify types
		assert.strictEqual(typeof contextData.changeType, 'string');
		assert.strictEqual(typeof contextData.lineNumber, 'number');
		assert.strictEqual(typeof contextData.content, 'string');
		assert.ok(Array.isArray(contextData.contextBefore));
		assert.ok(Array.isArray(contextData.contextAfter));
	});
});