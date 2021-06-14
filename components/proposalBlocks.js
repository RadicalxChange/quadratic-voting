import React, { useEffect, useRef } from "react";

function ProposalBlocks(props) {
  const canvasRef = useRef(null);
  const totalHeightBlocks = Math.sqrt(props.cost)

  useEffect(() => {
    draw()
      // eslint-disable-next-line react-hooks/exhaustive-deps
  },[props.cost]);

  // make canvas responsive
  window.addEventListener('resize', () => {
    draw()
  });

  const draw = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setUpCanvas(canvas, ctx);
        drawGraph(canvas, ctx);
      }
    }
  };

  // set up canvas dimensions
  const setUpCanvas = (canvas, ctx) => {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    var w = canvas.width, h = canvas.height;

    // set the scale of the context
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // scale the canvas by window.devicePixelRatio
    canvas.width = w*window.devicePixelRatio;
    canvas.height = h*window.devicePixelRatio;
  };

  // draw
  const drawGraph = (canvas, ctx) => {
    const cellHeight = Math.min(canvas.height / totalHeightBlocks, 10);
    const blockHeight = cellHeight * .7;
    const gutter = cellHeight - blockHeight;
    const px = (canvas.width - cellHeight*totalHeightBlocks) / 2
    const py = (canvas.height - cellHeight*totalHeightBlocks) / 2
    for (let j = 0; j < totalHeightBlocks; j++) {
      for (let i = 0; i < totalHeightBlocks; i++) {
        const x = px + (blockHeight + gutter) * i;
        const y = py + (blockHeight + gutter) * j + (gutter / 2);
        ctx.fillStyle = "black";
        ctx.fillRect(x, y, blockHeight, blockHeight);
      }
    }
  };

  return (
    <div className="canvas-wrapper">
      <canvas id="proposal-blocks" ref={canvasRef} />

      {/* Scoped styling */}
      <style jsx>{`
        .canvas-wrapper {
          height: 6rem;
          margin: 1rem 0;
          width: 100%;
          position: relative;
        }

        #proposal-blocks {
          border: none !important;
          height: 100% !important;
          width: 100% !important;
          position: relative;
          z-index: inherit;
        }
      `}</style>
    </div>
  );
}

export default ProposalBlocks;
