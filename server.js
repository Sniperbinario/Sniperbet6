<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>SniperBet - Jogos do Dia</title>
  <style>
    body {
      background-color: #0f0f0f;
      color: #e0e0e0;
      font-family: 'Segoe UI', sans-serif;
      padding: 20px;
    }
    .game {
      background-color: #1e1e1e;
      border-radius: 10px;
      padding: 15px;
      margin-bottom: 20px;
      box-shadow: 0 0 10px #000;
    }
    .teams {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .logo {
      height: 24px;
      vertical-align: middle;
      margin-right: 6px;
    }
    .time {
      font-size: 14px;
      margin-bottom: 10px;
      color: #ccc;
    }
    .stats, .recent-matches {
      font-size: 14px;
      margin-top: 10px;
    }
    .recent-matches {
      font-style: italic;
      margin-top: 15px;
    }
    .rec {
      margin-top: 10px;
      font-weight: bold;
      color: #00ff88;
    }
    hr {
      border: 0;
      border-top: 1px solid #333;
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <h1>⚽ SniperBet — Jogos do Dia</h1>
  <div id="games">Carregando...</div>

  <script>
    async function loadGames() {
      const res = await fetch('/games');
      const games = await res.json();

      const container = document.getElementById('games');
      container.innerHTML = '';

      games.forEach(game => {
        const div = document.createElement('div');
        div.className = 'game';

        const ultimosJogos = game.last5Matches.map(match =>
          `• ${match.date} — ${match.homeTeam} ${match.homeGoals} x ${match.awayGoals} ${match.awayTeam} (${match.venue})`
        ).join('<br>');

        div.innerHTML = `
          <div class="teams">
            <img src="${game.homeLogo}" class="logo"> ${game.homeTeam}
            vs
            <img src="${game.awayLogo}" class="logo"> ${game.awayTeam}
          </div>
          <div class="time">🕒 Horário: ${game.time}</div>
          <hr>
          <div class="stats">
            <strong>Médias (últimos 5 jogos):</strong><br>
            • Gols feitos: ${game.stats.goalsForAvg}<br>
            • Gols sofridos: ${game.stats.goalsAgainstAvg}<br>
            • Chutes: Média: ${game.stats.shotsAvg}<br>
            • Chutes ao gol: Média: ${game.stats.shotsOnAvg}<br>
            • Escanteios: Média: ${game.stats.cornersAvg}<br>
            • Cartões: Média: ${game.stats.cardsAvg}
          </div>
          <div class="recent-matches">
            <strong>Últimos 5 jogos:</strong><br>${ultimosJogos}
          </div>
          <div class="rec">🔎 ${game.recommendation}</div>
        `;

        container.appendChild(div);
      });
    }

    loadGames();
  </script>
</body>
</html>
