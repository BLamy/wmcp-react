# Agentic Component Builder

This system automates the component development lifecycle using AI. It uses GitHub Actions to turn component requests into fully functional, tested React components.

## How It Works

1. **Request a component** by creating a GitHub issue with the `component-request` label.
2. **Describe your component** in the issue body. Be detailed about what you want the component to do.
3. **Include any screenshots or mockups** in the issue if you have specific design requirements.
4. **The system automatically:**
   - Designs an API for your component
   - Creates a stub implementation
   - Writes comprehensive unit tests
   - Implements the component with debugging annotations
   - Creates a Storybook story
   - Takes screenshots and iterates until it looks right
   - Writes and runs Playwright tests
   - Uploads all artifacts (screenshots, test videos, coverage reports)
   - Creates a pull request with the finished component

## Example Issue

**Title:** TodoList Component

**Labels:** component-request

**Body:**
```
Build a component that displays a list of todo items with the following features:

- Show a list of todos with checkboxes
- Allow marking todos as complete/incomplete
- Display a count of remaining items
- Filter todos by status (all, active, completed)
- Allow adding new todos
- Allow deleting todos

The component should be fully accessible and keyboard navigable.
```

## Requirements

The agentic component builder needs the following secrets set in your repository:

- `OPENAI_API_KEY`: An API key for OpenAI's GPT-4 or later models
- `GEMINI_API_KEY`: An API key for Google's Gemini Pro model (for test failure diagnosis)

## How to Interpret Results

When the workflow completes, it will:

1. Create a new branch with your component
2. Open a PR with a summary of the implemented component
3. Provide screenshots, test videos, and coverage reports as GitHub Action artifacts
4. Comment on your original issue with a link to the PR

## Value Annotations

The component implementation includes value annotations at the end of each line:

```tsx
const [todos, setTodos] = useState([]); // [] (first render), [{ id: 1, ... }] (after adding)
```

These annotations help with debugging by showing how values change across component lifecycles.

## Customization

If you need to customize the component after generation:

1. Review the PR and make additional changes
2. Check the test coverage to ensure your changes maintain or improve coverage
3. Use the Storybook to visually verify your component behavior

## Limitations

- The system works best with clearly defined component requirements
- It may need human intervention for highly complex components
- Integration with existing application state should be handled manually 