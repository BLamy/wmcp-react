import React, { useState, useEffect } from 'react';
import { Form } from '../../../Form';
import { TextField } from '../../../TextField';
import { NumberField } from '../../../NumberField';
import { DateField } from '../../../DateField';
import { Checkbox } from '../../../Checkbox';
import { Button } from '../../../Button';

export interface Schema {
  properties?: Record<string, any>;
  required?: string[];
  title?: string;
  description?: string;
}

export interface DynamicFormProps {
  /** Schema to generate form fields from */
  schema: Schema;
  /** Initial form state */
  initialValues?: Record<string, any>;
  /** Handler for form submission */
  onSubmit: (values: Record<string, any>) => void;
  /** Optional button text */
  submitButtonText?: string;
  /** Whether the form is currently submitting */
  isSubmitting?: boolean;
  /** Optional additional CSS class names */
  className?: string;
  /** Form description shown at the top */
  formDescription?: string;
}

/**
 * A reusable dynamic form component that generates form fields from a JSON schema
 */
export function DynamicForm({
  schema,
  initialValues = {},
  onSubmit,
  submitButtonText = 'Submit',
  isSubmitting = false,
  className = '',
  formDescription
}: DynamicFormProps) {
  const [formState, setFormState] = useState<Record<string, any>>(initialValues);
  const [selectedSchemaVariant, setSelectedSchemaVariant] = useState<number>(0);
  
  // Reset form state when schema changes
  useEffect(() => {
    setFormState(initialValues);
    setSelectedSchemaVariant(0);
  }, [schema, initialValues]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formState);
  };

  // Helper to determine field type from schema
  const getFieldType = (schema: Schema, propertyName: string) => {
    if (!schema || !schema.properties || !schema.properties[propertyName]) {
      return 'string';
    }

    const property = schema.properties[propertyName];
    const type = property.type;

    if (property.enum) {
      return 'enum';
    } else if (property.oneOf || property.anyOf) {
      return 'variant';
    } else if (type === 'number' || type === 'integer') {
      return 'number';
    } else if (type === 'boolean') {
      return 'boolean';
    } else if (type === 'string') {
      if (property.format === 'date' || property.format === 'date-time') {
        return 'date';
      }
      return 'string';
    } else if (type === 'array') {
      return 'array';
    } else if (type === 'object') {
      return 'object';
    }
    
    return 'string';
  };

  // Update form state for a specific field
  const updateField = (name: string, value: any) => {
    setFormState(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Render variant selection for oneOf/anyOf
  const renderVariantField = (name: string, property: any) => {
    const variants = property.oneOf || property.anyOf || [];
    const isOneOf = !!property.oneOf;
    
    // No need for variant selection if only one option
    if (variants.length <= 1) {
      return renderSimpleField(name, variants[0] || {}, true);
    }

    return (
      <div key={name} className="border rounded-md p-3 mb-3">
        <div className="font-medium mb-2">{name}</div>
        <div className="mb-3">
          <label className="text-sm font-medium">
            Select {isOneOf ? 'one of' : 'any of'} these variants:
          </label>
          <select
            value={selectedSchemaVariant}
            onChange={(e) => setSelectedSchemaVariant(Number(e.target.value))}
            className="w-full px-3 py-2 mt-1 border-2 rounded-md focus:border-blue-600 focus:outline-none"
          >
            {variants.map((variant: any, index: number) => (
              <option key={index} value={index}>
                {variant.title || `Variant ${index + 1}`}
              </option>
            ))}
          </select>
        </div>
        {renderSimpleField(`${name}Value`, variants[selectedSchemaVariant] || {}, true)}
      </div>
    );
  };

  // Render a simple field based on its type
  const renderSimpleField = (name: string, property: any, isNested: boolean = false) => {
    const type = property.type || 'string';
    const description = property.description || '';
    
    if (property.enum) {
      return (
        <div key={name} className="flex flex-col gap-1">
          {!isNested && (
            <label className="text-sm font-medium">
              {name}
            </label>
          )}
          {description && (
            <div className="text-sm text-gray-600">{description}</div>
          )}
          <select 
            value={formState[name] || ''}
            onChange={(e) => updateField(name, e.target.value)}
            className="px-3 py-2 border-2 rounded-md focus:border-blue-600 focus:outline-none"
          >
            <option value="" disabled>Select an option</option>
            {property.enum?.map((value: any) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      );
    }
    
    switch (type) {
      case 'number':
      case 'integer':
        return (
          <NumberField
            key={name}
            label={!isNested ? name : undefined}
            description={description}
            value={formState[name] ?? ''}
            onChange={(value) => updateField(name, value)}
          />
        );
      case 'boolean':
        return (
          <Checkbox
            key={name}
            isSelected={formState[name] || false}
            onChange={(value) => updateField(name, value)}
          >
            {!isNested ? name : property.title || 'Value'}
          </Checkbox>
        );
      case 'object':
        return (
          <div key={name} className="border rounded-md p-3 mb-2">
            {!isNested && <div className="font-medium mb-2">{name}</div>}
            <TextField
              label={property.title || 'JSON Object'}
              description={description}
              value={typeof formState[name] === 'object' ? JSON.stringify(formState[name]) : formState[name] || ''}
              onChange={(value) => {
                try {
                  const parsed = JSON.parse(value);
                  updateField(name, parsed);
                } catch (e) {
                  // If not valid JSON, store as string
                  updateField(name, value);
                }
              }}
            />
          </div>
        );
      case 'array':
        return (
          <div key={name} className="border rounded-md p-3 mb-2">
            {!isNested && <div className="font-medium mb-2">{name}</div>}
            <TextField
              label={property.title || 'JSON Array'}
              description={description}
              value={Array.isArray(formState[name]) ? JSON.stringify(formState[name]) : formState[name] || '[]'}
              onChange={(value) => {
                try {
                  const parsed = JSON.parse(value);
                  updateField(name, parsed);
                } catch (e) {
                  // If not valid JSON, store as string
                  updateField(name, value);
                }
              }}
            />
          </div>
        );
      case 'string':
      default:
        return (
          <TextField
            key={name}
            label={!isNested ? name : property.title || 'Value'}
            description={description}
            value={formState[name] || ''}
            onChange={(value) => updateField(name, value)}
          />
        );
    }
  };

  // Render appropriate field based on schema
  const renderField = (name: string, schema: Schema) => {
    const property = schema?.properties?.[name] || {};
    const isRequired = schema?.required?.includes(name) || false;
    
    if (property.oneOf || property.anyOf) {
      return renderVariantField(name, property);
    }
    
    const fieldType = getFieldType(schema, name);
    const description = property.description || '';
    
    switch (fieldType) {
      case 'enum':
        return (
          <div key={name} className="flex flex-col gap-1">
            <label className="text-sm font-medium">
              {name}{isRequired ? ' *' : ''}
            </label>
            {description && (
              <div className="text-sm text-gray-600">{description}</div>
            )}
            <select 
              value={formState[name] || ''}
              onChange={(e) => updateField(name, e.target.value)}
              className="px-3 py-2 border-2 rounded-md focus:border-blue-600 focus:outline-none"
              required={isRequired}
            >
              <option value="" disabled>Select an option</option>
              {property.enum?.map((value: any) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        );
      case 'number':
        return (
          <NumberField
            key={name}
            label={`${name}${isRequired ? ' *' : ''}`}
            description={description}
            value={formState[name] ?? ''}
            onChange={(value) => updateField(name, value)}
            isRequired={isRequired}
          />
        );
      case 'boolean':
        return (
          <Checkbox
            key={name}
            isSelected={formState[name] || false}
            onChange={(value) => updateField(name, value)}
          >
            {name}{isRequired ? ' *' : ''}
          </Checkbox>
        );
      case 'date':
        return (
          <DateField
            key={name}
            label={`${name}${isRequired ? ' *' : ''}`}
            description={description}
            value={formState[name] || undefined}
            onChange={(value) => updateField(name, value)}
            isRequired={isRequired}
          />
        );
      case 'object':
        return (
          <div key={name} className="border rounded-md p-3 mb-2">
            <div className="font-medium mb-2">{name}{isRequired ? ' *' : ''}</div>
            <TextField
              label={`${name} (JSON)`}
              description={description}
              value={typeof formState[name] === 'object' ? JSON.stringify(formState[name], null, 2) : formState[name] || ''}
              onChange={(value) => {
                try {
                  const parsed = JSON.parse(value);
                  updateField(name, parsed);
                } catch (e) {
                  // If not valid JSON, store as string
                  updateField(name, value);
                }
              }}
              isRequired={isRequired}
            />
          </div>
        );
      case 'array':
        return (
          <div key={name} className="border rounded-md p-3 mb-2">
            <div className="font-medium mb-2">{name}{isRequired ? ' *' : ''}</div>
            <TextField
              label={`${name} (JSON array)`}
              description={description}
              value={Array.isArray(formState[name]) ? JSON.stringify(formState[name], null, 2) : formState[name] || '[]'}
              onChange={(value) => {
                try {
                  const parsed = JSON.parse(value);
                  updateField(name, parsed);
                } catch (e) {
                  // If not valid JSON, store as string
                  updateField(name, value);
                }
              }}
              isRequired={isRequired}
            />
          </div>
        );
      case 'string':
      default:
        return (
          <TextField
            key={name}
            label={`${name}${isRequired ? ' *' : ''}`}
            description={description}
            value={formState[name] || ''}
            onChange={(value) => updateField(name, value)}
            isRequired={isRequired}
          />
        );
    }
  };

  const properties = schema.properties || {};
  const propertyNames = Object.keys(properties);

  return (
    <Form onSubmit={handleSubmit} className={className}>
      {formDescription && (
        <div className="text-sm text-gray-600 mb-4">
          {formDescription}
        </div>
      )}
      
      {propertyNames.length === 0 ? (
        <div className="text-gray-500 italic mb-4">This form doesn't require any fields</div>
      ) : (
        propertyNames.map(name => renderField(name, schema))
      )}
      
      <Button type="submit" isDisabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : submitButtonText}
      </Button>
    </Form>
  );
} 