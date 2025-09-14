# WhyComment Context Extraction Service

This document describes the context extraction service implementation for the WhyComment VSCode extension.

## Overview

The Context Extraction Service analyzes code changes and extracts relevant context information for LLM analysis. It provides structured data about the code surrounding changes, including function/class boundaries and contextual lines.

## Features

### ✅ Implemented Features

- **Multi-language Support**: TypeScript, JavaScript, Python, and Java
- **Context Line Extraction**: Configurable N lines before and after changes (default: 10)
- **Function/Class Detection**: Automatic identification of containing functions and classes
- **Comment Filtering**: Option to exclude comment lines from context
- **File Boundary Handling**: Proper handling of file start/end boundaries
- **Structured Output**: JSON format with all required fields

### 🔧 Configuration

The service supports the following VS Code settings:

```json
{
  "whycomment.contextLines": 10,
  "whycomment.excludeComments": false
}
```

## Architecture

### Core Components

1. **Language Parsers** (`src/parsers/`)
   - `BaseParser`: Abstract base class with common functionality
   - `TypeScriptParser`: Handles TypeScript and JavaScript files
   - `PythonParser`: Handles Python files  
   - `JavaParser`: Handles Java files

2. **Context Extraction Service** (`src/contextExtractionService.ts`)
   - Main service class coordinating context extraction
   - Configuration management
   - File type detection and parser selection

3. **Type Definitions** (`src/types.ts`)
   - Core interfaces and data structures
   - `ContextData`, `ChangeInfo`, `FunctionInfo`, etc.

## Usage

### Basic Usage

```typescript
import { ContextExtractionService } from './contextExtractionService';
import { ChangeInfo } from './types';

const service = new ContextExtractionService();

const change: ChangeInfo = {
    filePath: '/path/to/file.ts',
    lineNumber: 15,
    changeType: 'modified',
    content: 'const result = calculate(a, b);'
};

const contextData = await service.extractSingleContext(change);
console.log(contextData);
```

### Output Format

The service returns `ContextData` objects with the following structure:

```typescript
{
  changeType: 'added' | 'modified' | 'deleted',
  lineNumber: number,
  content: string,
  contextBefore: string[],
  contextAfter: string[],
  functionName?: string,
  className?: string
}
```

### Example Output

```json
{
  "changeType": "modified",
  "lineNumber": 17,
  "content": "        const result = a + b;",
  "contextBefore": [
    "    public add(a: number, b: number): number {",
    "        // Validate input parameters",
    "        if (typeof a !== 'number' || typeof b !== 'number') {",
    "            throw new Error('Invalid input: both parameters must be numbers');",
    "        }"
  ],
  "contextAfter": [
    "        this.history.push(result);",
    "        return result;",
    "    }"
  ],
  "functionName": "add",
  "className": "Calculator"
}
```

## Language Support Details

### TypeScript/JavaScript
- **Function Detection**: Regular functions, arrow functions, methods, constructors
- **Class Detection**: Classes, interfaces, type definitions  
- **Comments**: `//`, `/* */`, JSDoc comments

### Python
- **Function Detection**: `def` functions, `async def` functions
- **Class Detection**: `class` definitions
- **Block Detection**: Indentation-based scope detection
- **Comments**: `#`, triple quotes docstrings

### Java
- **Method Detection**: Public, private, protected methods with visibility modifiers
- **Class Detection**: Classes, interfaces, enums
- **Block Detection**: Brace-based scope detection
- **Comments**: `//`, `/* */`, Javadoc comments

## Testing

The service includes comprehensive test coverage:

- **Parser Tests**: Function/class detection for each language
- **Comment Detection Tests**: Proper identification of comment lines
- **Configuration Tests**: Settings validation and file support detection
- **Edge Case Tests**: File boundaries, empty lines, malformed code

Run tests with:
```bash
npm test
```

## VS Code Integration

The service integrates with VS Code through:

1. **Command Registration**: `whycomment.extractContext` for manual testing
2. **Configuration Management**: Automatic updates when settings change
3. **File System Access**: Reading files through VS Code workspace API
4. **Output Display**: Results shown in VS Code Output panel

## Development and Testing

### Demo Command

Use the `WhyComment: Extract Context` command in the Command Palette to test context extraction on the current file and line.

### Manual Testing

1. Open a supported file (TypeScript, Python, Java)
2. Place cursor on a line of interest
3. Run `WhyComment: Extract Context` command
4. Check the Output panel for results

## Future Enhancements

- **Additional Languages**: C#, Go, Rust support
- **Improved Parsing**: More sophisticated AST-based parsing
- **Performance Optimization**: Caching and incremental parsing
- **Smart Context**: Semantic context detection beyond line counting

## Related Issues

- Implements: #7 (Context Extraction Service)
- Depends on: #2 (Git Diff Detection) - for change detection integration
- Enables: Future LLM analysis features