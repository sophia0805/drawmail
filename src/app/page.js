'use client';

import { useRef, useState, useEffect } from 'react';
import styles from './page.module.css';

export default function SketchPad() {
  const canvasRef = useRef(null);
  const [isDrawing, setDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [context, setContext] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setIndex] = useState(-1);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('Check out my drawing!');
  const [name, setName] = useState('- Anonymous');

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = 1200;
    canvas.height = 800;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setContext(ctx);
    saveHistory();
  }, []);

  useEffect(() => {
    if (context) {
      context.strokeStyle = color;
      context.lineWidth = brushSize;
    }
  }, [color, brushSize, context]);

  const saveHistory = () => {
    const canvas = canvasRef.current;
    const imageData = canvas.toDataURL();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(imageData);
    setHistory(newHistory);
    setIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setIndex(historyIndex - 1);
      loadHistory(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setIndex(historyIndex + 1);
      loadHistory(historyIndex + 1);
    }
  };

  const loadHistory = (index) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = history[index];
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    context.beginPath();
    context.moveTo(x, y);
    setDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setDrawing(false);
      saveHistory();
    }
  };

  const clearCanvas = () => {
    if (context) {
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      saveHistory();
    }
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = 'sketch.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  const shareDrawingViaSMS = async () => {
    if (!phoneNumber) {
      alert('Please enter a phone number');
      return;
    }

    const canvas = canvasRef.current;
    const imageData = canvas.toDataURL('image/png');
    try {
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          message: message + " " + name,
          imageData: imageData
        })
      });
      const result = await response.json();
      if (result.success) {
        alert(`Drawing sent successfully! Image uploaded to: ${result.mediaUrl}`);
      } else {
        alert('Failed to send drawing');
      }
    } catch (error) {
      console.error('Failed to send drawing:', error);
      alert('Failed to send drawing');
    }
  };

  return (
    <div className={styles.sketchPad}>
      <div className={styles.sidebar}>
        <h1>Drawmail</h1>
        <div className={styles.controls}>
          <div className={styles.controlGroup}>
            <label>Color:</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className={styles.colorPicker}
            />
          </div>
          <div className={styles.controlGroup}>
            <label htmlFor="brushSize">Brush Size:</label>
            <input
              type="range"
              id="brushSize"
              min="1"
              max="50"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className={styles.brushSlider}
            />
            <span className={styles.brushSize}>{brushSize}px</span>
          </div>
          <div className={styles.buttonGroup}>
            <button onClick={undo} className={styles.undoButton} disabled={historyIndex <= 0} >←</button>
            <button onClick={redo} className={styles.redoButton} disabled={historyIndex >= history.length - 1}>→</button>
          </div>
          <div className={styles.controlGroup}>
            <label>Phone Number:</label>
            <input
              type="tel"
              placeholder="+1234567890"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className={styles.phoneInput}
            />
          </div>
          <div className={styles.controlGroup}>
            <label>Message:</label>
            <input
              type="text"
              placeholder="Check out my drawing!"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <label>From:</label>
            <input
              type="text"
              placeholder="- Anonymous"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button onClick={shareDrawingViaSMS} className={styles.sendButton}>
            Send Drawing
          </button>
          <button onClick={clearCanvas} className={styles.clearButton}>
            Clear
          </button>
          <button onClick={downloadCanvas} className={styles.downloadButton}>
            Download
          </button>
        </div>
      </div>
      <div className={styles.canvasContainer}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />
      </div>
    </div>
  );
}
