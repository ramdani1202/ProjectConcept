import { useEffect, useState } from 'react';

export default function Toast({ message, onDone }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!message) return;
    setShow(true);
    const t = setTimeout(() => {
      setShow(false);
      setTimeout(onDone, 250);
    }, 1800);
    return () => clearTimeout(t);
  }, [message, onDone]);

  if (!message) return null;

  return (
    <div className={`toast${show ? ' show' : ''}`}>{message}</div>
  );
}
