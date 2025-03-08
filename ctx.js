import { useContext, createContext, useEffect, useState } from 'react';
import { useStorageState } from './useStorageState';
import * as SQLite from 'expo-sqlite';

const AuthContext = createContext({
  signIn: (email, password) => null,
  signOut: () => null,
  session: null,
  isLoading: false,
  error: null,

  tasks: [],
  addTask: (text) => null,
  deleteTask: (id) => null,
});

const VALID_EMAIL = 'usuario@ejemplo.com';
const VALID_PASSWORD = 'password123';

// Abre la base de datos SQLite de forma asíncrona
const openDatabaseAsync = async () => {
  const db = await SQLite.openDatabaseAsync('todo.db');
  return db;
};

// Hook para acceder a la sesión
export function useSession() {
  const value = useContext(AuthContext);
  if (process.env.NODE_ENV !== 'production') {
    if (!value) {
      throw new Error('useSession must be wrapped in a <SessionProvider />');
    }
  }

  return value;
}

export function SessionProvider({ children }) {
  const [[isLoadingSession, session], setSession] = useStorageState('user-session');
  const [[isLoadingError, error], setError] = useStorageState('auth-error');
  const [tasks, setTasks] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);

  // Inicializar la base de datos y cargar tareas
  useEffect(() => {
    const initDatabase = async () => {
      const db = await openDatabaseAsync();

      // Crear la tabla si no existe
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY NOT NULL,
          text TEXT NOT NULL,
          completed INTEGER DEFAULT 0,
          created_at TEXT
        );
      `);

      // Cargar tareas
      const loadedTasks = await db.getAllAsync('SELECT * FROM tasks ORDER BY created_at DESC');
      setTasks(loadedTasks);
      setIsLoadingTasks(false);
    };

    initDatabase().catch((error) => {
      console.error('Error al inicializar la base de datos:', error);
      setIsLoadingTasks(false);
    });
  }, []);

  const addTask = async (text) => {
    const createdAt = new Date().toISOString();
    const db = await openDatabaseAsync();

    try {
      const result = await db.runAsync(
        'INSERT INTO tasks (text, completed, created_at) VALUES (?, ?, ?)',
        text,
        0,
        createdAt
      );

      const newTask = {
        id: result.lastInsertRowId,
        text,
        completed: false,
        created_at: createdAt,
      };

      setTasks((prevTasks) => [newTask, ...prevTasks]);
    } catch (error) {
      console.error('Error al añadir tarea:', error);
    }
  };

  const deleteTask = async (id) => {
    const db = await openDatabaseAsync();

    try {
      await db.runAsync('DELETE FROM tasks WHERE id = ?', id);
      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
    } catch (error) {
      console.error('Error al eliminar tarea:', error);
    }
  };

  const signOut = () => {
    // Limpiar la sesión en SecureStore
    setSession(null);
    setError(null);

    // Redirigir al usuario a la pantalla de inicio de sesión
    // Esto se maneja en el layout de la aplicación
  };

  const isLoading = isLoadingSession || isLoadingError || isLoadingTasks;

  return (
    <AuthContext.Provider
      value={{
        signIn: (email, password) => {
          if (email === VALID_EMAIL && password === VALID_PASSWORD) {
            const userSession = {
              email,
              token: 'mock-jwt-token',
              timestamp: new Date().toISOString(),
            };
            setSession(JSON.stringify(userSession));
            setError(null);
            return true;
          } else {
            setError('Credenciales incorrectas');
            return false;
          }
        },
        signOut,
        session,
        isLoading,
        error,
        tasks,
        addTask,
        deleteTask,
      }}>
      {children}
    </AuthContext.Provider>
  );
}