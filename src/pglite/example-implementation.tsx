// example.tsx - Complete example demonstrating the system
import React, { useState, useEffect } from 'react';
import { DatabaseProvider, useTable, useDatabase } from './db-context';
import { Table, TableHeader, Column, Row, Cell } from '../components/aria/Table';
import { TableBody } from 'react-aria-components';
import LexicalEditor from './LexicalEditor';

// Define our schema for the Todo app
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS todos (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    priority TEXT DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS projects (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS tasks (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'backlog',
    priority TEXT DEFAULT 'medium',
    project_id BIGINT REFERENCES projects(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Create a context for sharing todos between components
const TodoContext = React.createContext<{
  todos: TodoItem[];
  addTodo: (todo: Omit<TodoItem, 'id'>) => void;
  toggleTodo: (id: number) => void;
  deleteTodo: (id: number) => void;
} | null>(null);

// Main Todo application
export function TodoApp() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const todosTable = useTable<ParsedSchema, 'todos'>('todos');

  // Load todos on mount
  useEffect(() => {
    const loadTodos = async () => {
      const results = await todosTable?.findMany();
      setTodos(results || []);
    };
    
    loadTodos();
  }, [todosTable]);

  // Add a new todo
  const addTodo = async (todo: Omit<TodoItem, 'id'>) => {
    try {
      const created = await todosTable?.create(todo);
      if (created) {
        setTodos(prev => [...prev, created]);
      }
    } catch (error) {
      console.error('Error creating todo:', error);
    }
  };

  // Toggle the completed status of a todo
  const toggleTodo = async (id: number) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    const updated = await todosTable?.update({
      where: { id },
      data: { completed: !todo.completed }
    });

    if (updated) {
      setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    }
  };

  // Delete a todo
  const deleteTodo = async (id: number) => {
    await todosTable?.delete({
      id
    });
    setTodos(todos.filter(t => t.id !== id));
  };

  const contextValue = {
    todos,
    addTodo,
    toggleTodo,
    deleteTodo
  };

  return (
    <DatabaseProvider schema={SCHEMA}>
      <TodoContext.Provider value={contextValue}>
        <div style={{ padding: '20px' }}>
          <h1 style={{ marginBottom: '20px' }}>Todo Application</h1>
          <TodoForm />
          <TodoList />
        </div>
      </TodoContext.Provider>
    </DatabaseProvider>
  );
}

// Component that displays the list of todos
export function TodoList() {
  const todoContext = React.useContext(TodoContext);
  
  if (!todoContext) {
    return <p>Todo context not available</p>;
  }
  
  const { todos, toggleTodo, deleteTodo } = todoContext;
  
  return (
    <div style={{ marginTop: '20px' }}>
      <h2>My Todos</h2>
      
      {todos.length === 0 ? (
        <p>No todos yet. Add one above!</p>
      ) : (
        <Table aria-label="Todo List">
          <TableHeader>
            <Column id="status" width={80}>Status</Column>
            <Column id="title" isRowHeader>Title</Column>
            <Column id="priority" width={100}>Priority</Column>
            <Column id="actions" width={100}>Actions</Column>
          </TableHeader>
          <TableBody items={todos}>
            {item => (
              <Row key={item.id}>
                <Cell>
                  <input 
                    type="checkbox" 
                    checked={item.completed} 
                    onChange={() => toggleTodo(item.id)}
                  />
                </Cell>
                <Cell>
                  <span style={{ 
                    textDecoration: item.completed ? 'line-through' : 'none',
                    color: item.completed ? '#999' : 'inherit'
                  }}>
                    {item.title}
                  </span>
                </Cell>
                <Cell>
                  <PriorityBadge priority={item.priority} />
                </Cell>
                <Cell>
                  <button 
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                    onClick={() => deleteTodo(item.id)}
                  >
                    Delete
                  </button>
                </Cell>
              </Row>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// Component for adding new todos
export function TodoForm() {
  const todoContext = React.useContext(TodoContext);
  const [newTitle, setNewTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  
  if (!todoContext) {
    return <p>Todo context not available</p>;
  }
  
  const { addTodo } = todoContext;
  
  // Add a new todo
  const handleAddTodo = async () => {
    if (!newTitle) return;
    
    await addTodo({
      title: newTitle,
      completed: false,
      priority
    });
    
    setNewTitle('');
    setPriority('medium');
  };
  
  return (
    <div style={{
      padding: '16px',
      backgroundColor: '#f9fafb',
      borderRadius: '8px',
      marginBottom: '20px'
    }}>
      <h2 style={{ marginBottom: '12px' }}>Add New Todo</h2>
      
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input
          style={{
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px',
            flexGrow: 1
          }}
          type="text"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="What needs to be done?"
        />
        
        <select
          style={{
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px',
          }}
          value={priority}
          onChange={e => setPriority(e.target.value as Priority)}
        >
          <option value="low">Low Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="high">High Priority</option>
        </select>
        
        <button 
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
          }}
          onClick={handleAddTodo}
        >
          Add Todo
        </button>
      </div>
    </div>
  );
}

// Linear-lite App
export function LinearLiteApp() {
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  
  return (
    <DatabaseProvider schema={SCHEMA}>
      <div style={{ 
        padding: '20px',
        maxWidth: '100%',
        height: 'calc(100vh - 40px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <div>
            <h1 style={{ margin: 0 }}>Linear-lite</h1>
            <p style={{ margin: '4px 0 0 0', color: '#6b7280' }}>A simplified version of Linear for project management</p>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              style={{
                padding: '8px 12px',
                backgroundColor: viewMode === 'board' ? '#3b82f6' : '#e5e7eb',
                color: viewMode === 'board' ? 'white' : '#374151',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onClick={() => setViewMode('board')}
            >
              <span>Board View</span>
            </button>
            
            <button
              style={{
                padding: '8px 12px',
                backgroundColor: viewMode === 'table' ? '#3b82f6' : '#e5e7eb',
                color: viewMode === 'table' ? 'white' : '#374151',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onClick={() => setViewMode('table')}
            >
              <span>Table View</span>
            </button>
            
            <button
              style={{
                padding: '8px 12px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onClick={() => setShowNewTaskModal(true)}
            >
              <span>+ Add Task</span>
            </button>
          </div>
        </div>
        
        <TaskBoard viewMode={viewMode} showNewTaskModal={showNewTaskModal} onCloseNewTaskModal={() => setShowNewTaskModal(false)} />
      </div>
    </DatabaseProvider>
  );
}

// TaskBoard component for the Linear-lite app
export function TaskBoard({ 
  viewMode = 'board',
  showNewTaskModal = false,
  onCloseNewTaskModal = () => {}
}: { 
  viewMode?: 'board' | 'table';
  showNewTaskModal?: boolean;
  onCloseNewTaskModal?: () => void;
}) {
  const projects = useTable<ParsedSchema, 'projects'>('projects');
  const tasks = useTable<ParsedSchema, 'tasks'>('tasks');
  const [projectItems, setProjectItems] = useState<ProjectItem[]>([]);
  const [taskItems, setTaskItems] = useState<TaskItem[]>([]);
  const [activeProject, setActiveProject] = useState<number | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [showTaskEditor, setShowTaskEditor] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Load projects and tasks on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const projectResults = await projects?.findMany();
        setProjectItems(projectResults || []);
        
        if (projectResults && projectResults.length > 0) {
          setActiveProject(projectResults[0].id);
          
          const taskResults = await tasks?.findMany({
            where: { project_id: projectResults[0].id }
          });
          
          setTaskItems(taskResults || []);
        } else {
          // Create default project and sample tasks if none exist
          await createDefaultProjectAndTasks();
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [projects, tasks]);

  // Create a default project and sample tasks if none exist
  const createDefaultProjectAndTasks = async () => {
    const project = await projects?.create({
      name: 'Sample Project',
      description: 'This is a sample project to get you started'
    });
    
    if (project) {
      setProjectItems([project]);
      setActiveProject(project.id);
      
      // Helper to create Lexical JSON for descriptions
      const createLexicalJSON = (text: string) => {
        return JSON.stringify({
          root: {
            children: [
              {
                children: [
                  {
                    detail: 0,
                    format: 0,
                    mode: "normal",
                    style: "",
                    text: text,
                    type: "text",
                    version: 1
                  }
                ],
                direction: "ltr",
                format: "",
                indent: 0,
                type: "paragraph",
                version: 1
              }
            ],
            direction: "ltr",
            format: "",
            indent: 0,
            type: "root",
            version: 1
          }
        });
      };
      
      const sampleTasks = [
        {
          title: 'Design user interface',
          description: createLexicalJSON('Create wireframes and mockups for the new app'),
          status: 'backlog' as TaskStatus,
          priority: 'high' as Priority,
          project_id: project.id
        },
        {
          title: 'Setup development environment',
          description: createLexicalJSON('Install necessary tools and configure the workspace'),
          status: 'todo' as TaskStatus,
          priority: 'medium' as Priority,
          project_id: project.id
        },
        {
          title: 'Implement authentication',
          description: createLexicalJSON('Add login and registration functionality'),
          status: 'in-progress' as TaskStatus,
          priority: 'high' as Priority,
          project_id: project.id
        }
      ];
      
      const createdTasks = [];
      for (const task of sampleTasks) {
        const newTask = await tasks?.create(task);
        if (newTask) createdTasks.push(newTask);
      }
      
      setTaskItems(createdTasks);
    }
  };
  
  // Change the active project
  const handleChangeProject = async (projectId: number) => {
    setActiveProject(projectId);
    setIsLoading(true);
    
    try {
      const taskResults = await tasks?.findMany({
        where: { project_id: projectId }
      });
      
      setTaskItems(taskResults || []);
    } catch (error) {
      console.error('Error changing project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Open task editor
  const handleOpenTask = (task: TaskItem) => {
    setSelectedTask(task);
    setShowTaskEditor(true);
  };

  // Close task editor
  const handleCloseTaskEditor = () => {
    setSelectedTask(null);
    setShowTaskEditor(false);
  };

  // Update task status
  const handleStatusChange = async (taskId: number, newStatus: TaskStatus) => {
    const task = taskItems.find(t => t.id === taskId);
    if (!task) return;

    const updated = await tasks?.update({
      where: { id: taskId },
      data: { status: newStatus }
    });

    if (updated) {
      setTaskItems(taskItems.map(t => 
        t.id === taskId ? { ...t, status: newStatus } : t
      ));
    }
  };

  // Create a new task
  const handleCreateTask = async (task: Omit<TaskItem, 'id'>) => {
    if (!activeProject) return;
    
    try {
      const newTask = await tasks?.create({
        ...task,
        project_id: activeProject
      });
      
      if (newTask) {
        setTaskItems([...taskItems, newTask]);
        onCloseNewTaskModal();
      }
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  // Update an existing task
  const handleUpdateTask = async (updatedTask: TaskItem) => {
    const updated = await tasks?.update({
      where: { id: updatedTask.id },
      data: {
        title: updatedTask.title,
        description: updatedTask.description,
        status: updatedTask.status,
        priority: updatedTask.priority
      }
    });

    if (updated) {
      setTaskItems(taskItems.map(t => 
        t.id === updatedTask.id ? updated : t
      ));
    }
  };
  
  // Group tasks by status
  const groupedTasks = {
    backlog: taskItems.filter(task => task.status === 'backlog'),
    todo: taskItems.filter(task => task.status === 'todo'),
    'in-progress': taskItems.filter(task => task.status === 'in-progress'),
    done: taskItems.filter(task => task.status === 'done'),
  };

  // Get status label
  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'backlog': return 'Backlog';
      case 'todo': return 'Todo';
      case 'in-progress': return 'In Progress';
      case 'done': return 'Done';
      default: return status.replace('-', ' ');
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <p>Loading...</p>
      </div>
    );
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
        {projectItems.map(project => (
          <button
            key={project.id}
            style={{
              padding: '8px 16px',
              backgroundColor: activeProject === project.id ? '#3b82f6' : '#e5e7eb',
              color: activeProject === project.id ? 'white' : '#374151',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
            onClick={() => handleChangeProject(project.id)}
          >
            {project.name}
          </button>
        ))}
      </div>
      
      {showNewTaskModal && (
        <div style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{ 
            backgroundColor: 'white',
            borderRadius: '8px',
            width: '800px',
            maxWidth: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }}>
            <TaskEditorModal 
              task={{ 
                id: 0, 
                title: '', 
                description: '', 
                status: 'todo', 
                priority: 'medium', 
                project_id: activeProject || 0 
              }} 
              isNew={true}
              onClose={onCloseNewTaskModal} 
              onSave={handleCreateTask}
            />
          </div>
        </div>
      )}
      
      {showTaskEditor && selectedTask ? (
        <div style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{ 
            backgroundColor: 'white',
            borderRadius: '8px',
            width: '800px',
            maxWidth: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }}>
            <TaskEditorModal 
              task={selectedTask} 
              onClose={handleCloseTaskEditor} 
              onSave={handleUpdateTask}
            />
          </div>
        </div>
      ) : null}
      
      {viewMode === 'board' ? (
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          overflowX: 'auto',
          height: '100%',
          padding: '4px 0'
        }}>
          {Object.entries(groupedTasks).map(([status, tasks]) => (
            <div 
              key={status}
              style={{
                minWidth: '300px',
                width: '300px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
              }}
            >
              <h3 style={{ 
                textTransform: 'capitalize', 
                margin: '16px',
                borderBottom: '1px solid #e5e7eb',
                paddingBottom: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                {getStatusLabel(status)} <span style={{ color: '#6b7280', fontWeight: 'normal' }}>{tasks.length}</span>
              </h3>
              
              <div style={{ 
                flex: 1, 
                overflowY: 'auto',
                padding: '0 16px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {tasks.length === 0 ? (
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: 'rgba(0,0,0,0.05)',
                    borderRadius: '4px',
                    color: '#6b7280',
                    fontSize: '14px',
                    textAlign: 'center'
                  }}>
                    No tasks yet
                  </div>
                ) : (
                  tasks.map(task => (
                    <div 
                      key={task.id}
                      style={{
                        padding: '12px',
                        backgroundColor: 'white',
                        borderRadius: '4px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleOpenTask(task)}
                    >
                      <div style={{ fontWeight: 'bold' }}>{task.title}</div>
                      {task.description && (
                        <div style={{ 
                          fontSize: '14px', 
                          color: '#6b7280', 
                          marginTop: '4px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          {extractTextFromLexical(task.description)}
                        </div>
                      )}
                      <div style={{ marginTop: '8px' }}>
                        <PriorityBadge priority={task.priority} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {taskItems.length === 0 ? (
            <div style={{ 
              padding: '32px', 
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <p>No tasks found. Create a new task to get started.</p>
            </div>
          ) : (
            <Table 
              aria-label="Tasks" 
              selectionMode="single"
              onRowAction={(key) => {
                const task = taskItems.find(t => t.id === key);
                if (task) handleOpenTask(task);
              }}
            >
              <TableHeader>
                <Column id="title" isRowHeader>Title</Column>
                <Column id="status">Status</Column>
                <Column id="priority">Priority</Column>
                <Column id="created_at">Created</Column>
              </TableHeader>
              <TableBody items={taskItems}>
                {task => (
                  <Row>
                    <Cell>{task.title}</Cell>
                    <Cell>
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          padding: '4px 8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '14px',
                        }}
                      >
                        <option value="backlog">Backlog</option>
                        <option value="todo">Todo</option>
                        <option value="in-progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    </Cell>
                    <Cell><PriorityBadge priority={task.priority} /></Cell>
                    <Cell>{task.created_at ? new Date(task.created_at).toLocaleDateString() : ''}</Cell>
                  </Row>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}

// Task editor modal component
function TaskEditorModal({ task, isNew = false, onClose, onSave }: { 
  task: TaskItem, 
  isNew?: boolean,
  onClose: () => void, 
  onSave: (task: TaskItem) => Promise<void> 
}) {
  const [editedTask, setEditedTask] = useState<TaskItem>({...task});
  const [saving, setSaving] = useState(false);
  
  // Format the description for display if it exists
  useEffect(() => {
    if (task.description) {
      try {
        // Validate if it's already valid JSON to avoid double parsing
        JSON.parse(task.description);
      } catch (e) {
        // If not valid JSON and not empty, wrap it in a simple Lexical structure
        if (task.description.trim()) {
          const simpleStructure = {
            root: {
              children: [
                {
                  children: [
                    {
                      detail: 0,
                      format: 0,
                      mode: "normal",
                      style: "",
                      text: task.description,
                      type: "text",
                      version: 1
                    }
                  ],
                  direction: "ltr",
                  format: "",
                  indent: 0,
                  type: "paragraph",
                  version: 1
                }
              ],
              direction: "ltr",
              format: "",
              indent: 0,
              type: "root",
              version: 1
            }
          };
          setEditedTask(prev => ({
            ...prev, 
            description: JSON.stringify(simpleStructure)
          }));
        }
      }
    }
  }, [task]);
  
  const handleSave = async () => {
    if (!editedTask.title.trim()) {
      alert('Title is required');
      return;
    }
    
    setSaving(true);
    try {
      await onSave(editedTask);
      onClose();
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Failed to save task');
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: 0 }}>{isNew ? 'New Task' : 'Task Details'}</h2>
        <button 
          onClick={onClose}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '4px 8px',
            color: '#6b7280'
          }}
        >
          ×
        </button>
      </div>
      
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontWeight: '500',
        }}>
          Title
        </label>
        <input
          type="text"
          value={editedTask.title}
          onChange={(e) => setEditedTask({...editedTask, title: e.target.value})}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '14px',
            boxSizing: 'border-box',
          }}
        />
      </div>
      
      <div style={{ 
        display: 'flex', 
        gap: '16px',
        marginBottom: '16px'
      }}>
        <div style={{ flex: 1 }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: '500',
          }}>
            Status
          </label>
          <select
            value={editedTask.status}
            onChange={(e) => setEditedTask({...editedTask, status: e.target.value as TaskStatus})}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          >
            <option value="backlog">Backlog</option>
            <option value="todo">Todo</option>
            <option value="in-progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>
        
        <div style={{ flex: 1 }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: '500',
          }}>
            Priority
          </label>
          <select
            value={editedTask.priority}
            onChange={(e) => setEditedTask({...editedTask, priority: e.target.value as Priority})}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontWeight: '500',
        }}>
          Description
        </label>
        <div style={{
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <LexicalEditor
            placeholder="Enter a detailed description of this task..."
            initialContent={editedTask.description}
            onChange={(content) => setEditedTask({...editedTask, description: content})}
          />
        </div>
      </div>
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end',
        gap: '8px',
        marginTop: '20px'
      }}>
        <button 
          onClick={onClose}
          style={{
            padding: '8px 16px',
            backgroundColor: 'transparent',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
          disabled={saving}
        >
          Cancel
        </button>
        <button 
          onClick={handleSave}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
          }}
          disabled={saving}
        >
          {saving ? 'Saving...' : isNew ? 'Create Task' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// Priority badge component
function PriorityBadge({ priority }: { priority: Priority }) {
  const getBgColor = () => {
    switch(priority) {
      case 'low': return '#e5e7eb';
      case 'medium': return '#fef3c7';
      case 'high': return '#fee2e2';
      default: return '#e5e7eb';
    }
  };
  
  const getTextColor = () => {
    switch(priority) {
      case 'low': return '#374151';
      case 'medium': return '#92400e';
      case 'high': return '#b91c1c';
      default: return '#374151';
    }
  };
  
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '9999px',
      fontSize: '12px',
      fontWeight: '500',
      backgroundColor: getBgColor(),
      color: getTextColor(),
      textTransform: 'capitalize'
    }}>
      {priority}
    </span>
  );
}

// Type definitions
type Priority = 'low' | 'medium' | 'high';
type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'done';

// Utility function to extract readable text from Lexical JSON
function extractTextFromLexical(jsonString: string): string {
  // If it's empty, return empty string
  if (!jsonString || jsonString.trim() === '') {
    return '';
  }
  
  // Check if it looks like a JSON string (starts with {)
  if (jsonString.trim().startsWith('{')) {
    try {
      // Try to parse the JSON
      const parsed = JSON.parse(jsonString);
      if (!parsed || !parsed.root || !parsed.root.children) {
        return jsonString; // Return original if JSON doesn't have expected structure
      }

      // Extract text from each paragraph
      const textContent: string[] = [];
      
      for (const node of parsed.root.children) {
        if (node.type === 'paragraph' && node.children) {
          const paragraphText = node.children
            .filter((child: any) => child.type === 'text')
            .map((child: any) => child.text || '')
            .join('');
          
          if (paragraphText.trim()) {
            textContent.push(paragraphText);
          }
        } else if (node.type === 'heading' && node.children) {
          const headingText = node.children
            .filter((child: any) => child.type === 'text')
            .map((child: any) => child.text || '')
            .join('');
          
          if (headingText.trim()) {
            textContent.push(headingText);
          }
        }
      }
      
      return textContent.join(' ').trim() || jsonString;
    } catch (error) {
      // If we can't parse the JSON, return the string directly
      console.warn('Error parsing Lexical JSON', error);
    }
  }
  
  // Return the original string if not JSON or if JSON parsing failed
  return jsonString;
}

type TodoItem = {
  id: number;
  title: string;
  completed: boolean;
  priority: Priority;
  created_at?: string;
};

type ProjectItem = {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
};

type TaskItem = {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  project_id: number;
  created_at?: string;
};

// Helper function to parse schema
function ParseSchema(schemaString: string) {
  return {} as {
    todos: TodoItem;
    projects: ProjectItem;
    tasks: TaskItem;
  };
}

// Schema parse result
type ParsedSchema = ReturnType<typeof ParseSchema>;

const PARSED_SCHEMA = ParseSchema(SCHEMA);

// TaskEditor component with Lexical implementation - maintained for story compatibility
export function TaskEditor() {
  const [taskTitle, setTaskTitle] = useState('');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('todo');
  const [taskPriority, setTaskPriority] = useState<Priority>('medium');
  
  return (
    <div style={{ padding: '20px' }}>
      <h2>Task Editor</h2>
      <p>Create or edit a task with rich text description</p>
      
      <form style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        marginTop: '16px',
      }}>
        <div>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: '500',
          }}>
            Task Title
          </label>
          <input
            type="text"
            value={taskTitle}
            onChange={e => setTaskTitle(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
            placeholder="Enter task title"
          />
        </div>
        
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '500',
            }}>
              Status
            </label>
            <select
              value={taskStatus}
              onChange={e => setTaskStatus(e.target.value as TaskStatus)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            >
              <option value="backlog">Backlog</option>
              <option value="todo">Todo</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
          
          <div style={{ flex: 1 }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '500',
            }}>
              Priority
            </label>
            <select
              value={taskPriority}
              onChange={e => setTaskPriority(e.target.value as Priority)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
        
        <div>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: '500',
          }}>
            Description
          </label>
          <LexicalEditor
            placeholder="Enter a detailed description of this task..."
          />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
          <button 
            type="button" 
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Save Task
          </button>
        </div>
      </form>
    </div>
  );
}

export default TodoApp;

