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
import { FileIcon, FolderIcon } from "lucide-react";

// Define a resource interface
export interface Resource {
  name: string;
  mimeType?: string;
  text?: string;
  uri?: string;
}
interface ResourceMenuProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  resources?: Resource[];
  onSelectResource?: (resource: Resource) => void;
}

export function ResourceMenu({
  isOpen,
  onOpenChange,
  resources = [],
  onSelectResource
}: ResourceMenuProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#252526] border border-[#3c3c3c] p-0 max-w-md w-full">
        <Command className="bg-transparent">
          <CommandInput
            placeholder="Search resources..."
            className="border-b border-[#3c3c3c] focus:ring-0 text-white"
          />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty className="py-6 text-center text-gray-400">
              No resources found.
            </CommandEmpty>
            <CommandGroup heading="Available Resources" className="px-2 py-1.5 text-xs text-gray-400">
              {resources.map((resource) => (
                <CommandItem
                  key={resource.name}
                  onSelect={() => {
                    onSelectResource?.(resource);
                    onOpenChange(false);
                  }}
                  className="flex items-center gap-2 rounded-md p-2 cursor-pointer hover:bg-[#3c3c3c] text-white"
                >
                  {resource.mimeType?.includes('folder') ? (
                    <FolderIcon className="h-4 w-4 text-yellow-400" />
                  ) : (
                    <FileIcon className="h-4 w-4 text-blue-400" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{resource.name}</div>
                    {resource.uri && (
                      <div className="text-xs text-gray-500 italic">{resource.uri}</div>
                    )}
                    {resource.text && (
                      <div className="text-xs text-gray-400">{resource.text}</div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
} 