const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

app.get('/games', async (req, res) => {
  const apiKey = process.env.API_KEY;

  // IDs dos campeonatos importantes
  const leagues = [13, 71, 72, 39, 140, 135];
  const date = new Date().toISOString().split('T')[0];

  try {
    let allGames = [];

    for (const leagueId of leagues) {
      const response = await axios.get(
        `https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${date}&league=${leagueId}&season=2024`,
        {
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
          },
        }
      );

      const games = response.data.response.map((game) => ({
        homeTeam: game.teams.home.name,
        awayTeam: game.teams.away.name,
        time: new Date(game.fixture.date).toLocaleTimeString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
        }),
        homeLogo: game.teams.home.logo,
        awayLogo: game.teams.away.logo,
        stats: {
          goalsForAvg: (Math.random() * 3).toFixed(1),
          goalsAgainstAvg: (Math.random() * 3).toFixed(1),
          shotsTotal: Math.floor(Math.random() * 50),
          shotsOn: Math.floor(Math.random() * 20),
          shotsTotalAvg: (Math.random() * 10).toFixed(1),
          shotsOnAvg: (Math.random() * 5).toFixed(1),
          cornersAvg: (Math.random() * 8).toFixed(1),
          cardsAvg: (Math.random() * 6).toFixed(1),
        },
        recommendation:
          Math.random() > 0.5 ? 'Vale apostar' : 'Não vale apostar',
      }));

      allGames.push(...games);
    }

    res.json(allGames);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar jogos' });
  }
});

app.listen(PORT, () => {
  console.log(`SniperBet rodando na porta ${PORT}`);
});
