import React from "react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "../components/ui/command";
import { Dialog, DialogContent } from "../components/ui/dialog";
import { Sparkles, MessageSquare } from "lucide-react";

// Define prompt interface
export interface Prompt {
  id: string;
  name: string;
  description: string;
  content: string;
  category: string;
}

// Default prompts
const DEFAULT_PROMPTS: Prompt[] = [
  {
    id: "code-review",
    name: "Code Review",
    description: "Ask for a thorough code review with best practices and suggestions",
    content: "Please review this code and suggest improvements for readability, performance, and best practices:",
    category: "Development"
  },
  {
    id: "explain-code",
    name: "Explain Code",
    description: "Ask for a detailed explanation of how code works",
    content: "Please explain how this code works, what each part does, and the overall architecture:",
    category: "Development"
  },
  {
    id: "refactor",
    name: "Refactor Code",
    description: "Ask for code refactoring suggestions",
    content: "Please refactor this code to improve its structure, readability, and performance:",
    category: "Development"
  },
  {
    id: "test-generation",
    name: "Generate Tests",
    description: "Ask for test cases for your code",
    content: "Please generate comprehensive test cases for this code, including edge cases:",
    category: "Testing"
  },
  {
    id: "bug-fix",
    name: "Debug Code",
    description: "Ask for help fixing a bug in your code",
    content: "I'm encountering a bug in this code. The expected behavior is [...] but instead it's [...]. Please help me identify and fix the issue:",
    category: "Debugging"
  }
];

interface PromptMenuProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  prompts?: Prompt[];
  onSelectPrompt?: (prompt: Prompt) => void;
}

export function PromptMenu({ 
  isOpen, 
  onOpenChange, 
  prompts = DEFAULT_PROMPTS, 
  onSelectPrompt 
}: PromptMenuProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  
  // Group prompts by category
  const promptsByCategory = React.useMemo(() => {
    const grouped: Record<string, Prompt[]> = {};
    
    prompts.forEach(prompt => {
      if (!grouped[prompt.category]) {
        grouped[prompt.category] = [];
      }
      
      // Filter by search query if present
      if (!searchQuery || 
          prompt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          prompt.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        grouped[prompt.category].push(prompt);
      }
    });
    
    // Remove empty categories after filtering
    Object.keys(grouped).forEach(category => {
      if (grouped[category].length === 0) {
        delete grouped[category];
      }
    });
    
    return grouped;
  }, [prompts, searchQuery]);
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#252526] border border-[#3c3c3c] p-0 max-w-md w-full">
        <Command className="bg-transparent">
          <CommandInput 
            placeholder="Search prompt templates..." 
            className="border-b border-[#3c3c3c] focus:ring-0 text-white"
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty className="py-6 text-center text-gray-400">
              No prompt templates found.
            </CommandEmpty>
            
            {Object.entries(promptsByCategory).map(([category, categoryPrompts]) => (
              <CommandGroup key={category} heading={category} className="px-2 py-1.5 text-xs text-gray-400">
                {categoryPrompts.map((prompt) => (
                  <CommandItem
                    key={prompt.id}
                    onSelect={() => {
                      onSelectPrompt?.(prompt);
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2 rounded-md p-2 cursor-pointer hover:bg-[#3c3c3c] text-white"
                  >
                    <div className="flex-shrink-0">
                      {prompt.category === "Development" ? (
                        <Sparkles className="h-4 w-4 text-blue-400" />
                      ) : (
                        <MessageSquare className="h-4 w-4 text-green-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{prompt.name}</div>
                      <div className="text-xs text-gray-400">{prompt.description}</div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
} 