import React, { useRef, useEffect } from 'react';

function CanvasBlocks(props) {
  const canvasRef = useRef(null);
  // the blocks are drawn in "stacks" of 25
  const numStacks = Math.ceil(props.creditBalance / 25);
  // set the size of the gap between stacks here
  const stackGutter = 3;

  useEffect(() => {
    draw()
      // eslint-disable-next-line react-hooks/exhaustive-deps
  },[props.creditBalance, props.creditsRemaining]);

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
    const [nrows, ncols, stack_size] = optimizeStackHeight(canvas);
    const stackHeight = Math.min(+stack_size - (2 * stackGutter), 90);
    const widthPixels = ncols * stackHeight;
    const padding = ((canvas.width - widthPixels) / 2) - stackGutter;
    const cellHeight = stackHeight / 5;
    const gutterHeight = 0.3 * cellHeight;
    const blockHeight = cellHeight - gutterHeight;
    ctx.fillStyle = "black";
    let counter = 0;
    // loop through each row of stacks
    for (let stackRow = 0; stackRow < nrows; stackRow++) {
      // loop through each stack in the current row
      for (let stackCol = 0; stackCol < ncols; stackCol++) {
        // draw the current stack of blocks
        for (let j = 0; j < 5; j++) {
          for (let i = 0; i < 5 && counter < props.creditBalance; i++) {
            // draw the ith block in the jth row of the current stack
            const blockCol = stackCol*5 + i;
            const blockRow = stackRow*5 + j;
            const x = padding + (blockHeight + gutterHeight) * blockCol
              + stackGutter * Math.floor(blockCol / 5);
            const y = canvas.height - ((blockHeight + gutterHeight) * blockRow
              + stackGutter * Math.floor(counter / (25 * ncols))
              + gutterHeight + blockHeight);
            /*
            if the user allocates the current block to a proposal, then
            remove it from their budget
            */
            if (counter < props.creditsRemaining) {
              ctx.fillRect(x, y, blockHeight, blockHeight);
            } else {
              ctx.clearRect(x, y, blockHeight, blockHeight);
            }
            counter++;
          }
        }
      }
    }
  };

  // https://math.stackexchange.com/questions/466198/algorithm-to-get-the-maximum-size-of-n-squares-that-fit-into-a-rectangle-with-a
  const optimizeStackHeight = (canvas) => {
    // Compute number of rows and columns, and cell size
    var ratio = canvas.width / canvas.height;
    var ncols_float = Math.sqrt(numStacks * ratio);
    var nrows_float = numStacks / ncols_float;

    // Find best option filling the whole height
    var nrows1 = Math.ceil(nrows_float);
    var ncols1 = Math.ceil(numStacks / nrows1);
    while (nrows1 * ratio < ncols1) {
        nrows1++;
        ncols1 = Math.ceil(numStacks / nrows1);
    }
    var cell_size1 = canvas.height / nrows1;

    // Find best option filling the whole width
    var ncols2 = Math.ceil(ncols_float);
    var nrows2 = Math.ceil(numStacks / ncols2);
    while (ncols2 < nrows2 * ratio) {
        ncols2++;
        nrows2 = Math.ceil(numStacks / ncols2);
    }
    var cell_size2 = canvas.width / ncols2;

    // Find the best values
    var nrows, ncols, cell_size;
    if (cell_size1 < cell_size2) {
        nrows = nrows2;
        ncols = ncols2;
        cell_size = cell_size2;
    } else {
        nrows = nrows1;
        ncols = ncols1;
        cell_size = cell_size1;
    }
    return [nrows, ncols, cell_size];
  }

  return (
    <div className="canvas-wrapper">
      <h3>Available Voice Credits</h3>
      <canvas id="remaining-credits-blocks" ref={canvasRef} />
      <p>
        {props.creditsRemaining}/{props.creditBalance} voice credits remaining
      </p>

      {/* Scoped styling */}
      <style jsx>{`
        .canvas-wrapper {
          position: relative;
          margin: 1vw;
        }

        #remaining-credits-blocks {
          padding: .5rem !important;
          border: none !important;
          max-height: 10vh;
          width: 100%;
          object-fit: contain;
        }

        @media only screen and (min-width: 768px) {
          .canvas-wrapper {
            margin-bottom: 1rem;
            width: 17vw;
          }

          #remaining-credits-blocks {
            max-height: none;
            max-width: 80%;
            height: 40vh;
          }
        }
      `}</style>
    </div>
  );
};

export default CanvasBlocks;
