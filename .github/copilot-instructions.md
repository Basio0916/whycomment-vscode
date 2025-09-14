# WhyComment VSCode Extension Development

WhyComment is a Visual Studio Code extension that analyzes code changes and suggests comments for unclear code patterns. The extension detects "why?" moments in code using LLM analysis and helps developers add explanatory comments proactively.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Initial Project Setup
The repository currently contains only planning documents (PRD). To start development:

- **Install Node.js dependencies globally**:
  - `npm install -g yo generator-code @vscode/vsce`
  - Takes 2-3 minutes. NEVER CANCEL. Set timeout to 5+ minutes.

- **Generate VS Code extension scaffold**:
  - `yo code` (interactive - select "New Extension (TypeScript)")
  - Choose appropriate bundler (esbuild recommended for performance)
  - Takes 30-60 seconds for generation + 2-3 minutes for npm install

- **Core dependencies validation**:
  - Node.js 18+ required (current: 20.19.5)
  - VS Code 1.80+ recommended for development
  - TypeScript compilation takes 3-5 seconds
  - ESLint validation takes 1-2 seconds

### Build and Development Process
- **Compile TypeScript**: `npm run compile` -- takes 3-5 seconds
- **Watch mode for development**: `npm run watch` -- continuous compilation
- **Lint code**: `npm run lint` -- takes 1-2 seconds  
- **Package for distribution**: `vsce package --allow-missing-repository --skip-license` -- takes 5-7 seconds
- **NEVER CANCEL**: All build commands complete quickly (under 10 seconds). Set timeout to 30+ seconds for safety.

### Testing and Validation
- **Unit tests**: `npm test` -- FAILS in headless environments (expected - requires VS Code GUI)
- **Manual validation**: Use F5 debugging in VS Code IDE
- **Extension testing**: Load .vsix file in VS Code for functional testing
- **Always validate**: Core extension activation, command registration, and user interactions

### Development Workflow Validation
After making changes, ALWAYS run this validation sequence:
1. `npm run compile` -- verify TypeScript compilation
2. `npm run lint` -- verify code style  
3. `vsce package --allow-missing-repository --skip-license` -- verify packaging
4. Load extension in VS Code and test core functionality (F5 debug mode)
5. Test command palette integration (`Ctrl+Shift+P`)

## Project Structure and Key Files

### Essential Files
```
package.json           -- Extension manifest (commands, activation events)
src/extension.ts       -- Main extension logic (activate/deactivate)
src/test/             -- Unit tests directory
.vscode/              -- VS Code configuration (launch, tasks, settings)
.vscode/launch.json   -- Debug configuration for F5
.vscode/tasks.json    -- Build tasks configuration  
tsconfig.json         -- TypeScript configuration
```

### WhyComment-Specific Implementation Areas
Based on the PRD, focus development in these areas:
- **Git integration**: Detect file changes and diffs
- **LLM API integration**: OpenAI GPT-4o-mini for code analysis
- **Side panel UI**: Display analysis results and suggestions
- **Comment insertion**: Automated comment placement
- **Settings management**: API keys, exclusion patterns, limits

### Configuration and Linting
- **Always run before commits**: `npm run lint`
- **TypeScript strict mode**: Enabled in tsconfig.json
- **ESLint configuration**: eslint.config.mjs with TypeScript rules
- **VS Code settings**: .vscode/settings.json for editor configuration

## Development Scenarios and Troubleshooting

### Extension Architecture Requirements
For WhyComment implementation:
- **Activation events**: File save triggers (`onDidSaveTextDocument`)
- **Commands**: `whycomment.analyzeChanges`, `whycomment.applyComment`
- **UI components**: TreeView for sidebar, StatusBar for progress
- **Storage**: Extension context for caching and settings

### Common Issues and Solutions
- **"Repository missing" in packaging**: Use `--allow-missing-repository` flag
- **Template README error**: Replace template content before packaging  
- **Test failures in CI**: Expected - VS Code tests require GUI environment
- **TypeScript compilation errors**: Check @types/vscode version compatibility
- **Extension not loading**: Verify activation events in package.json

### Performance Considerations  
- **Debounce file saves**: 3-second delay (configurable)
- **Cache LLM responses**: Prevent duplicate API calls
- **Limit analysis scope**: 50 lines maximum change detection
- **API rate limiting**: 100 requests/day default limit

## API Integration and Dependencies

### Required Dependencies (to be added)
```json
{
  "@types/vscode": "^1.104.0",
  "openai": "^4.x",
  "simple-git": "^3.x"
}
```

### LLM Integration Pattern
```typescript
// API configuration in settings
"whycomment.apiKey": "",
"whycomment.apiProvider": "openai",
"whycomment.contextLines": 10
```

### Git Integration Requirements
- **Detect repository**: `git status` validation
- **Get file diffs**: `git diff HEAD~1 --name-only`  
- **Change analysis**: Line-by-line diff processing
- **Branch awareness**: Current branch context for analysis

## Validation Scenarios

### End-to-End Testing Workflow
ALWAYS test these scenarios after implementation changes:
1. **Extension activation**: Load extension, verify commands appear in palette
2. **File save detection**: Modify file, save, verify analysis trigger
3. **Git diff analysis**: Make code changes, verify diff detection
4. **Comment suggestion**: Apply suggested comment, verify insertion  
5. **Settings integration**: Modify configuration, verify behavior change
6. **Error handling**: Test with invalid API key, no git repository

### Manual Testing Checklist
- [ ] Extension loads without errors in Output panel
- [ ] Commands visible in Command Palette (`Ctrl+Shift+P`)
- [ ] Side panel displays correctly
- [ ] File save triggers analysis (after 3-second delay)
- [ ] LLM API integration works with valid key
- [ ] Comment insertion preserves code formatting
- [ ] Settings changes take effect immediately

## Repository Context and Planning

### Current State
Repository contains:
- Product Requirements Document (README.md in Japanese)
- GitHub issue templates and basic CI workflow
- No source code yet - requires initial scaffolding

### Development Phases
1. **Phase 1**: Basic extension scaffold and activation
2. **Phase 2**: Git integration and file monitoring  
3. **Phase 3**: LLM API integration and analysis
4. **Phase 4**: UI components and comment insertion
5. **Phase 5**: Settings, caching, and optimization

### Success Metrics (from PRD)
- MVP: File save detection → LLM analysis → sidebar display → comment insertion
- Target: VS Code Marketplace publication with 100+ downloads
- Quality: Comprehensive error handling and user experience validation

### コメントについて
- Agentモードやレビュー時のコメントは日本語で記載してください
