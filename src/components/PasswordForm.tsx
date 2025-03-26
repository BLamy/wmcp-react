import React from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface PasswordFormProps {
  entry?: Partial<{
    id: number;
    title: string;
    username: string;
    password: string;
    url?: string;
    notes?: string;
    category: string;
    subcategory?: string;
  }>;
  onSave: (entry: any) => void;
  onCancel: () => void;
}

// Define the vault categories and their subcategories
const vaultCategories = {
  "Passwords": [
    "Social Media",
    "Email",
    "Banking",
    "Shopping",
    "Work",
    "Entertainment",
    "Other"
  ],
  "Payment Methods": [
    "Credit Cards",
    "Debit Cards",
    "Bank Accounts",
    "Digital Wallets",
    "Cryptocurrency"
  ],
  "Secure Notes": [
    "Personal",
    "Work",
    "Medical",
    "Legal",
    "Other"
  ],
  "Personal Info": [
    "Contact Details",
    "Addresses",
    "Emergency Contacts",
    "Medical Info",
    "Other"
  ],
  "IDs & Licenses": [
    "Government ID",
    "Passport",
    "Driver's License",
    "Professional License",
    "Other"
  ]
};

export const PasswordForm: React.FC<PasswordFormProps> = ({ entry = {}, onSave, onCancel }) => {
  const [formData, setFormData] = React.useState({
    title: entry.title || '',
    username: entry.username || '',
    password: entry.password || '',
    url: entry.url || '',
    notes: entry.notes || '',
    category: entry.category || 'Passwords',
    subcategory: entry.subcategory || ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCategoryChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      category: value,
      subcategory: '' // Reset subcategory when category changes
    }));
  };

  const handleSubcategoryChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      subcategory: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...entry,
      ...formData
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select
            name="category"
            value={formData.category}
            onValueChange={handleCategoryChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(vaultCategories).map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subcategory">Subcategory</Label>
          <Select
            name="subcategory"
            value={formData.subcategory}
            onValueChange={handleSubcategoryChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a subcategory" />
            </SelectTrigger>
            <SelectContent>
              {vaultCategories[formData.category as keyof typeof vaultCategories]?.map(subcategory => (
                <SelectItem key={subcategory} value={subcategory}>
                  {subcategory}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder="Enter title"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          value={formData.username}
          onChange={handleChange}
          placeholder="Enter username"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Enter password"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="url">URL</Label>
        <Input
          id="url"
          name="url"
          value={formData.url}
          onChange={handleChange}
          placeholder="Enter URL (optional)"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="Enter notes (optional)"
          rows={3}
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="default">
          Save
        </Button>
      </div>
    </form>
  );
}; 