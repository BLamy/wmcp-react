import React, { useState, useCallback, useMemo } from 'react';

export interface TodoItem {
  id: number;
  text: string;
  completed: boolean;
}

export type FilterType = 'all' | 'active' | 'completed';

export interface TodoProps {
  initialTodos?: TodoItem[];
  onTodoChange?: (todos: TodoItem[]) => void;
  onTodoAdd?: (todo: TodoItem) => void;
  onTodoDelete?: (id: number) => void;
  onTodoToggle?: (id: number, completed: boolean) => void;
}

export function Todo({
  initialTodos = [],
  onTodoChange,
  onTodoAdd,
  onTodoDelete,
  onTodoToggle,
}: TodoProps) {
  const [todos, setTodos] = useState<TodoItem[]>(initialTodos); // [] (first render), [{id: 1, text: 'Learn React', completed: false}] (after adding)
  const [newTodoText, setNewTodoText] = useState(''); // '' (initial), 'Learn React' (while typing), '' (after add)
  const [filter, setFilter] = useState<FilterType>('all'); // 'all' (initial), 'active' (after click)
  
  const handleAddTodo = useCallback(() => {
    if (newTodoText.trim() === '') return; // '' (on invalid add attempt)
    
    const newTodo = {
      id: Date.now(), // 1678945628453 (example timestamp)
      text: newTodoText,
      completed: false,
    };
    
    const updatedTodos = [...todos, newTodo]; // [{id: 1, text: 'Learn React', completed: false}] (after first add)
    setTodos(updatedTodos);
    setNewTodoText('');
    
    onTodoAdd?.(newTodo);
    onTodoChange?.(updatedTodos);
  }, [newTodoText, todos, onTodoAdd, onTodoChange]); // [callback dependencies at first render], [callback dependencies after text change]
  
  const handleDeleteTodo = useCallback((id: number) => {
    const updatedTodos = todos.filter(todo => todo.id !== id); // [all todos except the deleted one]
    setTodos(updatedTodos);
    
    onTodoDelete?.(id);
    onTodoChange?.(updatedTodos);
  }, [todos, onTodoDelete, onTodoChange]); // [callback dependencies at each render]
  
  const handleToggleTodo = useCallback((id: number) => {
    const updatedTodos = todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ); // [todos with the toggled item updated]
    setTodos(updatedTodos);
    
    const toggledTodo = todos.find(todo => todo.id === id); // {id: 1, text: 'Learn React', completed: false} (before toggle)
    onTodoToggle?.(id, toggledTodo ? !toggledTodo.completed : false);
    onTodoChange?.(updatedTodos);
  }, [todos, onTodoToggle, onTodoChange]); // [callback dependencies at each render]
  
  const filteredTodos = useMemo(() => {
    switch (filter) {
      case 'active':
        return todos.filter(todo => !todo.completed); // [only active todos]
      case 'completed':
        return todos.filter(todo => todo.completed); // [only completed todos]
      default:
        return todos; // [all todos]
    }
  }, [todos, filter]); // [{id: 1, text: 'Learn React', completed: false}] (initial), [{filtered todos based on filter}] (after filter change)
  
  const activeCount = useMemo(() => {
    return todos.filter(todo => !todo.completed).length; // 1 (with one active todo), 0 (all completed)
  }, [todos]); // [computed after todos change]

  return (
    <div className="todo-container">
      <h2>Todo List</h2>
      
      <div className="todo-add">
        <input
          type="text"
          value={newTodoText} // '' (initial), 'Learn React' (while typing)
          onChange={(e) => setNewTodoText(e.target.value)}
          placeholder="Add a new todo..."
        />
        <button onClick={handleAddTodo}>Add</button>
      </div>
      
      <div className="todo-filters">
        <button 
          onClick={() => setFilter('all')} 
          className={filter === 'all' ? 'active' : ''} // 'active' (initial), '' (after selecting another filter)
        >
          All
        </button>
        <button 
          onClick={() => setFilter('active')} 
          className={filter === 'active' ? 'active' : ''} // '' (initial), 'active' (when active filter selected)
        >
          Active
        </button>
        <button 
          onClick={() => setFilter('completed')} 
          className={filter === 'completed' ? 'active' : ''} // '' (initial), 'active' (when completed filter selected)
        >
          Completed
        </button>
      </div>
      
      <ul className="todo-list">
        {filteredTodos.map(todo => ( // Renders based on current filter state
          <li key={todo.id} className={todo.completed ? 'completed' : ''}>
            <input
              type="checkbox"
              checked={todo.completed} // false (initial), true (after checking)
              onChange={() => handleToggleTodo(todo.id)}
            />
            <span>{todo.text}</span>
            <button onClick={() => handleDeleteTodo(todo.id)}>Delete</button>
          </li>
        ))}
      </ul>
      
      <div className="todo-count">
        {activeCount} {activeCount === 1 ? 'item' : 'items'} left // "1 item left" (with one active todo)
      </div>
    </div>
  );
} 