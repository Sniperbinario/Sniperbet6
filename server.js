const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

// IDs das ligas conforme especificado
const leagueIds = [
  71,  // Brasileirão Série A
  72,  // Brasileirão Série B
  73,  // Copa do Brasil
  13,  // Copa Libertadores
  39,  // Premier League
  140, // La Liga
  135, // Serie A (Itália)
  45,  // FA Cup
  307, // Campeonato Saudita
  309, // UAE Pro League
  94,  // Primeira Liga (Portugal)
  289, // Campeonato Sul-Africano
  78,  // Playoffs Liga Holandesa
  205, // Campeonato Eslovaco
  61   // Segunda Liga Francesa - Playoff de Rebaixamento
];

const season = 2024;

app.get('/games', async (req, res) => {
  const apiKey = process.env.API_KEY;
  const brDate = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const [day, month, year] = brDate.split('/');
  const today = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

  let finalGames = [];

  try {
    for (const leagueId of leagueIds) {
      const fixtureRes = await axios.get(`https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${today}&league=${leagueId}&season=${season}`, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      });

      const fixtures = fixtureRes.data.response;

      for (const match of fixtures) {
        const fixtureId = match.fixture.id;
        const homeTeam = match.teams.home.name;
        const awayTeam = match.teams.away.name;
        const homeLogo = match.teams.home.logo;
        const awayLogo = match.teams.away.logo;
        const time = new Date(match.fixture.date).toLocaleTimeString('pt-BR', {
          timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit'
        });

        finalGames.push({
          fixtureId,
          homeTeam,
          awayTeam,
          homeLogo,
          awayLogo,
          time
        });
      }
    }

    res.json(finalGames.length > 0 ? finalGames : []);
  } catch (err) {
    console.error('Erro geral:', err.message);
    res.json([]);
  }
});

app.listen(PORT, () => {
  console.log(`🔥 SniperBet rodando na porta ${PORT}`);
});
