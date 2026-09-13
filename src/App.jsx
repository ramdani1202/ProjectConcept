import { useState, useEffect, useCallback } from 'react';
import { DB } from './db.js';
import { uid } from './utils.js';
import ProjectList from './components/ProjectList.jsx';
import CanvasScreen from './components/CanvasScreen.jsx';
import Toast from './components/Toast.jsx';

export default function App() {
  const [projects, setProjects] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  useEffect(() => {
    DB.getAll().then((all) => {
      setProjects(all);
      setLoaded(true);
    });
  }, []);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
  }, []);

  const createProject = useCallback(async () => {
    const project = {
      id: uid(),
      name: 'Project baru',
      updatedAt: Date.now(),
      nodes: [],
      connections: []
    };
    await DB.put(project);
    setProjects((prev) => [...prev, project]);
    setCurrentId(project.id);
  }, []);

  const deleteProject = useCallback(async (id) => {
    await DB.remove(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updateProject = useCallback((id, updater) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? updater(p) : p)));
  }, []);

  const persistProject = useCallback(async (project) => {
    const toSave = { ...project, updatedAt: Date.now() };
    await DB.put(toSave);
  }, []);

  if (!loaded) return null;

  const currentProject = projects.find((p) => p.id === currentId) || null;

  return (
    <div id="app">
      {!currentProject && (
        <ProjectList
          projects={projects}
          onOpen={setCurrentId}
          onCreate={createProject}
          onDelete={deleteProject}
        />
      )}
      {currentProject && (
        <CanvasScreen
          project={currentProject}
          onBack={() => setCurrentId(null)}
          onUpdate={(updater) => updateProject(currentProject.id, updater)}
          onPersist={persistProject}
          onToast={showToast}
        />
      )}
      <Toast message={toastMsg} onDone={() => setToastMsg(null)} />
    </div>
  );
}
