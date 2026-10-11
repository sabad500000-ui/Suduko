 const AudioCtx = window.AudioContext || window.webkitAudioContext;
    let audioCtx = null;

    function getAudioCtx() {
      if (!audioCtx) audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    }

    function playTone(freq, type, duration, gainVal = 0.1) {
      try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(gainVal, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch(e) {}
    }

    const sound = {
      click: () => playTone(600, 'sine', 0.08, 0.05),
      correct: () => {
        playTone(523.25, 'triangle', 0.12);
        setTimeout(() => playTone(659.25, 'triangle', 0.18), 90);
      },
      error: () => playTone(180, 'sawtooth', 0.22, 0.08),
      win: () => {
        [523, 659, 783, 1046].forEach((f, i) => {
          setTimeout(() => playTone(f, 'sine', 0.22, 0.1), i * 110);
        });
      }
    };

    // --- منطق و وضعیت بازی ---
    let size = 4;
    let subR = 2, subC = 2;
    let board = [];
    let initialBoard = [];
    let solution = [];
    let selectedCell = null;
    let timer = 0;
    let timerInterval = null;
    let isPlaying = false;
    let mistakes = 0;
    let hintsRemaining = 3;
    let currentDifficulty = 'easy';

    // تبدیل ارقام انگلیسی به فارسی
    const faDigits = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
    function toFa(num) {
      return num.toString().replace(/\d/g, d => faDigits[d]);
    }

    // تولید سودوکو استاندارد و معتبر
    function generateValidSudoku(n, rBlock, cBlock) {
      let grid = Array.from({length: n}, () => Array(n).fill(0));
      
      function isValid(g, r, c, val) {
        for (let i = 0; i < n; i++) {
          if (g[r][i] === val || g[i][c] === val) return false;
        }
        let startR = Math.floor(r / rBlock) * rBlock;
        let startC = Math.floor(c / cBlock) * cBlock;
        for (let i = 0; i < rBlock; i++) {
          for (let j = 0; j < cBlock; j++) {
            if (g[startR + i][startC + j] === val) return false;
          }
        }
        return true;
      }

      function solve(g) {
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            if (g[r][c] === 0) {
              let numbers = Array.from({length: n}, (_, i) => i + 1).sort(() => Math.random() - 0.5);
              for (let num of numbers) {
                if (isValid(g, r, c, num)) {
                  g[r][c] = num;
                  if (solve(g)) return true;
                  g[r][c] = 0;
                }
              }
              return false;
            }
          }
        }
        return true;
      }

      solve(grid);
      return grid;
    }

    // مقداردهی و ساخت بازی تازه
    function prepareNewGame() {
      document.getElementById('winModal').style.display = 'none';
      stopTimer();
      timer = 0;
      mistakes = 0;
      hintsRemaining = 3;
      updateStatsUI();

      if (currentDifficulty === 'easy') {
        size = 4; subR = 2; subC = 2;
      } else if (currentDifficulty === 'medium') {
        size = 6; subR = 2; subC = 3;
      } else {
        size = 9; subR = 3; subC = 3;
      }

      solution = generateValidSudoku(size, subR, subC);
      board = Array.from({length: size}, () => Array(size).fill(0));
      initialBoard = Array.from({length: size}, () => Array(size).fill(false));

      // مشخص کردن تعداد خانه‌های آشکار بر حسب سطح
      let totalCells = size * size;
      let removeCount = Math.floor(totalCells * (currentDifficulty === 'easy' ? 0.4 : currentDifficulty === 'medium' ? 0.5 : 0.6));

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          board[r][c] = solution[r][c];
          initialBoard[r][c] = true;
        }
      }

      let removed = 0;
      while (removed < removeCount) {
        let r = Math.floor(Math.random() * size);
        let c = Math.floor(Math.random() * size);
        if (board[r][c] !== 0) {
          board[r][c] = 0;
          initialBoard[r][c] = false;
          removed++;
        }
      }

      selectedCell = null;
      renderBoardUI();
      renderNumpad();
      
      // تنظیم دکمه شروع
      isPlaying = false;
      const startBtn = document.getElementById('startBtn');
      startBtn.innerText = '▶️ شروع بازی';
      startBtn.classList.remove('btn-action');
      startBtn.classList.add('btn-start');
      setBoardInteractivity(false);
    }

    function togglePlayState() {
      const btn = document.getElementById('startBtn');
      if (!isPlaying) {
        isPlaying = true;
        btn.innerText = '⏸️ توقف';
        btn.classList.remove('btn-start');
        btn.classList.add('btn-action');
        startTimer();
        setBoardInteractivity(true);
      } else {
        isPlaying = false;
        btn.innerText = '▶️ ادامه';
        btn.classList.remove('btn-action');
        btn.classList.add('btn-start');
        stopTimer();
        setBoardInteractivity(false);
      }
    }

    function setBoardInteractivity(enabled) {
      const boardEl = document.getElementById('board');
      boardEl.style.opacity = enabled ? '1' : '0.4';
      boardEl.style.pointerEvents = enabled ? 'auto' : 'none';
    }

    // رسم جدول
    function renderBoardUI() {
      const boardEl = document.getElementById('board');
      boardEl.innerHTML = '';
      boardEl.className = `sudoku-grid grid-${size}`;
      boardEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
      boardEl.style.gridTemplateRows = `repeat(${size}, 1fr)`;

      let fontSize = size === 4 ? '1.8rem' : size === 6 ? '1.35rem' : '1.05rem';

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const cell = document.createElement('div');
          cell.className = 'cell';
          cell.style.fontSize = fontSize;
          cell.dataset.r = r;
          cell.dataset.c = c;

          if (board[r][c] !== 0) {
            cell.innerText = toFa(board[r][c]);
            cell.classList.add('fixed');
          }

          cell.addEventListener('click', () => selectCell(r, c));
          boardEl.appendChild(cell);
        }
      }
    }

    // رسم کیبورد اعداد
    function renderNumpad() {
      const numpadEl = document.getElementById('numpad');
      numpadEl.innerHTML = '';

      for (let i = 1; i <= size; i++) {
        const btn = document.createElement('button');
        btn.className = 'num-btn';
        btn.innerText = toFa(i);
        btn.onclick = () => fillNumber(i);
        numpadEl.appendChild(btn);
      }

      const eraseBtn = document.createElement('button');
      eraseBtn.className = 'num-btn erase';
      eraseBtn.innerText = '✕';
      eraseBtn.onclick = eraseNumber;
      numpadEl.appendChild(eraseBtn);
    }

    function selectCell(r, c) {
      if (!isPlaying) return;
      sound.click();
      selectedCell = { r, c };
      updateHighlights();
    }

    function updateHighlights() {
      const cells = document.querySelectorAll('.cell');
      cells.forEach(el => {
        el.classList.remove('selected', 'highlight', 'same-number');
        if (!selectedCell) return;

        const r = parseInt(el.dataset.r);
        const c = parseInt(el.dataset.c);
        const cellVal = board[r][c];
        const selVal = board[selectedCell.r][selectedCell.c];

        if (r === selectedCell.r && c === selectedCell.c) {
          el.classList.add('selected');
        } else if (
          r === selectedCell.r || 
          c === selectedCell.c || 
          (Math.floor(r / subR) === Math.floor(selectedCell.r / subR) && 
           Math.floor(c / subC) === Math.floor(selectedCell.c / subC))
        ) {
          el.classList.add('highlight');
        }

        if (selVal !== 0 && cellVal === selVal) {
          el.classList.add('same-number');
        }
      });
    }

    function fillNumber(num) {
      if (!isPlaying || !selectedCell) return;
      const { r, c } = selectedCell;

      if (initialBoard[r][c]) return;

      const cellEl = getCellEl(r, c);

      if (solution[r][c] === num) {
        board[r][c] = num;
        cellEl.innerText = toFa(num);
        cellEl.className = 'cell user';
        sound.correct();
        checkGameWin();
      } else {
        mistakes++;
        sound.error();
        cellEl.innerText = toFa(num);
        cellEl.classList.add('error');
        setTimeout(() => {
          cellEl.classList.remove('error');
          cellEl.innerText = '';
        }, 500);
      }

      updateStatsUI();
      updateHighlights();
    }

    function eraseNumber() {
      if (!isPlaying || !selectedCell) return;
      const { r, c } = selectedCell;
      if (initialBoard[r][c]) return;

      sound.click();
      board[r][c] = 0;
      const cellEl = getCellEl(r, c);
      cellEl.innerText = '';
      cellEl.className = 'cell';
      updateHighlights();
    }

    function useHint() {
      if (!isPlaying || hintsRemaining <= 0) return;

      let emptyList = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (board[r][c] === 0) emptyList.push({r, c});
        }
      }

      if (emptyList.length === 0) return;

      const target = emptyList[Math.floor(Math.random() * emptyList.length)];
      board[target.r][target.c] = solution[target.r][target.c];
      
      const cellEl = getCellEl(target.r, target.c);
      cellEl.innerText = toFa(solution[target.r][target.c]);
      cellEl.className = 'cell user hint-anim';
      sound.correct();

      hintsRemaining--;
      updateStatsUI();
      selectCell(target.r, target.c);

      setTimeout(() => {
        cellEl.classList.remove('hint-anim');
      }, 1200);

      checkGameWin();
    }

    function getCellEl(r, c) {
      return document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
    }

    function checkGameWin() {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (board[r][c] !== solution[r][c]) return;
        }
      }

      // اتمام موفق بازی
      stopTimer();
      sound.win();
      triggerCoinsRain();

      const modal = document.getElementById('winModal');
      document.getElementById('winSummary').innerText = `زمان: ${toFa(formatTime(timer))} | اشتباه: ${toFa(mistakes)}`;
      modal.style.display = 'flex';
    }

    function triggerCoinsRain() {
      const container = document.getElementById('coinsContainer');
      container.innerHTML = '';
      const icons = ['⭐', '🌟', '🎉', '👏', '🎈'];
      for (let i = 0; i < 25; i++) {
        const coin = document.createElement('div');
        coin.className = 'coin';
        coin.innerText = icons[Math.floor(Math.random() * icons.length)];
        coin.style.left = `${Math.random() * 95}%`;
        coin.style.animationDelay = `${Math.random() * 0.8}s`;
        container.appendChild(coin);
      }
      setTimeout(() => container.innerHTML = '', 2500);
    }

    // تایمر و آمار
    function startTimer() {
      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        timer++;
        document.getElementById('timerText').innerText = toFa(formatTime(timer));
      }, 1000);
    }

    function stopTimer() {
      clearInterval(timerInterval);
    }

    function formatTime(s) {
      const m = Math.floor(s / 60).toString().padStart(2, '0');
      const sec = (s % 60).toString().padStart(2, '0');
      return `${m}:${sec}`;
    }

    function updateStatsUI() {
      document.getElementById('timerText').innerText = toFa(formatTime(timer));
      document.getElementById('mistakesText').innerText = toFa(mistakes);
      document.getElementById('hintsText').innerText = toFa(hintsRemaining);
    }

    // رویدادهای سختی
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        sound.click();
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDifficulty = btn.dataset.diff;
        
        const labels = {
          easy: 'کلاس دوم (ساده)',
          medium: 'کلاس سوم و چهارم',
          hard: 'حرفه‌ای و باهوش‌ها'
        };
        document.getElementById('levelName').innerText = labels[currentDifficulty];
        prepareNewGame();
      });
    });

    // شروع نخست
    window.onload = () => {
      prepareNewGame();
    };
