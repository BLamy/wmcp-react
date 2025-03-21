import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ChatList } from '@/wmcp/components/chat/ChatList';
import { userEvent, within } from '@storybook/testing-library';

// Sample messages for stories
const sampleMessages = [
  {
    id: '1',
    sender: 'John Doe',
    date: 'Today, 10:30 AM',
    subject: 'Project Update',
    message: 'Just wanted to check in about the progress of the project. Let me know if you need any help with the implementation.'
  },
  {
    id: '2',
    sender: 'Sarah Miller',
    date: 'Yesterday, 3:45 PM',
    subject: 'Meeting Reminder',
    message: 'Don\'t forget about our team meeting tomorrow at 2:00 PM. We\'ll be discussing the new feature requirements.'
  },
  {
    id: '3',
    sender: 'David Chen',
    date: 'Mar 18, 9:12 AM',
    subject: 'Code Review Request',
    message: 'Could you please review my pull request when you get a chance? I\'ve implemented the chat list component with swipe to delete functionality.'
  },
  {
    id: '4',
    sender: 'Emma Wilson',
    date: 'Mar 17, 2:20 PM',
    subject: 'Design Assets',
    message: 'I\'ve uploaded the design assets for the new chat UI. You can find them in the shared folder.'
  },
  {
    id: '5',
    sender: 'Michael Johnson',
    date: 'Mar 16, 11:05 AM',
    subject: 'Bug Report',
    message: 'I found a bug in the chat list where swiping doesn\'t work properly on mobile devices. Let\'s fix it as soon as possible.'
  }
];

const meta: Meta<typeof ChatList> = {
  title: 'Components/ChatList',
  component: ChatList,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    messages: { control: 'object' }
  }
};

export default meta;
type Story = StoryObj<typeof ChatList>;

// Empty chat list
export const Empty: Story = {
  args: {
    messages: []
  }
};

// With messages
export const WithMessages: Story = {
  args: {
    messages: sampleMessages
  }
};

// Interaction example: Deleting a message by swiping
export const SwipeToDelete: Story = {
  args: {
    messages: sampleMessages
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Find the first message item
    const messageItems = canvas.getAllByRole('gridcell');
    if (messageItems.length > 0) {
      // Simulate swiping the first message to the left
      // Note: This is a simplified simulation as Storybook testing library
      // doesn't fully support complex gestures like swiping
      const firstMessage = messageItems[0];
      
      // Create pointer events to simulate swipe
      const startEvent = new PointerEvent('pointerdown', {
        bubbles: true,
        clientX: 300,
        clientY: 100
      });
      
      const moveEvent = new PointerEvent('pointermove', {
        bubbles: true,
        clientX: 100,
        clientY: 100
      });
      
      const endEvent = new PointerEvent('pointerup', {
        bubbles: true,
        clientX: 100,
        clientY: 100
      });
      
      // Dispatch events to simulate swipe
      firstMessage.dispatchEvent(startEvent);
      firstMessage.dispatchEvent(moveEvent);
      firstMessage.dispatchEvent(endEvent);
      
      // Wait for animation
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};

// Interaction example: Selecting multiple messages
export const SelectMultipleMessages: Story = {
  args: {
    messages: sampleMessages
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Click edit button to enter selection mode
    const editButton = canvas.getByText('Edit');
    await userEvent.click(editButton);
    
    // Select a couple of messages
    const messageItems = canvas.getAllByRole('gridcell');
    if (messageItems.length >= 2) {
      await userEvent.click(messageItems[0]);
      await userEvent.click(messageItems[2]);
      
      // Wait a moment to see the selection
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Delete selected messages
      const deleteButton = canvas.getByText('Delete');
      await userEvent.click(deleteButton);
      
      // Wait to see the result
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}; 