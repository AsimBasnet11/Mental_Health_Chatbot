import React, { useEffect, useRef } from 'react';

const SentimentGraph = ({ data }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth;
    const height = canvas.height = 200;

    // Clear
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 20, right: 15, bottom: 30, left: 40 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Grid lines
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Y-axis labels
      ctx.fillStyle = 'rgba(167, 139, 250, 0.6)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${100 - i * 25}%`, padding.left - 5, y + 3);
    }

    const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW;

    // Draw line helper
    const drawLine = (values, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      values.forEach((val, i) => {
        const x = padding.left + (data.length > 1 ? i * xStep : xStep / 2);
        const y = padding.top + chartH - (val * chartH);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Points
      values.forEach((val, i) => {
        const x = padding.left + (data.length > 1 ? i * xStep : xStep / 2);
        const y = padding.top + chartH - (val * chartH);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    // Emotion scores (purple)
    drawLine(data.map(d => d.emotion_score), '#a78bfa');

    // Category scores (pink)
    drawLine(data.map(d => d.category_score), '#f472b6');

    // X-axis labels
    data.forEach((d, i) => {
      const x = padding.left + (data.length > 1 ? i * xStep : xStep / 2);
      ctx.fillStyle = 'rgba(167, 139, 250, 0.6)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.message_number, x, height - 8);
    });

  }, [data]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-purple-300">📊 Sentiment Trend</h3>
      <canvas ref={canvasRef} className="w-full" />
      <div className="flex gap-4 text-xs text-purple-400/70">
        <div className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-purple-400 inline-block rounded"></span>
          Emotion
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-pink-400 inline-block rounded"></span>
          Category
        </div>
      </div>
    </div>
  );
};

export default SentimentGraph;
