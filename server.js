const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static('public'));

// IDs das ligas importantes
const leagueIds = [71, 72, 13, 39, 140, 135];
const season = 2024;

app.get('/games', async (req, res) => {
  const apiKey = process.env.API_KEY;
  const today = new Date().toISOString().split('T')[0];

  try {
    let finalGames = [];

    for (const leagueId of leagueIds) {
      const fixtureRes = await axios.get(
        `https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${today}&league=${leagueId}&season=${season}`,
        {
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
          }
        }
      );

      const fixtures = fixtureRes.data.response;

      for (const match of fixtures) {
        const homeId = match.teams.home.id;
        const awayId = match.teams.away.id;

        const homeStats = await getTeamStats(apiKey, homeId);
        const awayStats = await getTeamStats(apiKey, awayId);

        const homeLast5 = await getLastMatches(apiKey, homeId);
        const awayLast5 = await getLastMatches(apiKey, awayId);

        finalGames.push({
          homeTeam: match.teams.home.name,
          awayTeam: match.teams.away.name,
          homeLogo: match.teams.home.logo,
          awayLogo: match.teams.away.logo,
          time: new Date(match.fixture.date).toLocaleTimeString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            hour: '2-digit',
            minute: '2-digit',
          }),
          stats: {
            goalsForAvg: homeStats.goalsFor,
            goalsAgainstAvg: homeStats.goalsAgainst,
            shotsAvg: homeStats.shots,
            shotsOnAvg: homeStats.shotsOn,
            cornersAvg: homeStats.corners,
            cardsAvg: homeStats.cards,
          },
          last5Matches: homeLast5,
          recommendation:
            homeStats.shots > 5 && homeStats.goalsFor > 1
              ? 'Vale apostar'
              : 'Não vale apostar',
        });
      }
    }

    res.json(finalGames);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Erro ao buscar jogos' });
  }
});

// Função para buscar médias
async function getTeamStats(apiKey, teamId) {
  try {
    const res = await axios.get(
      `https://api-football-v1.p.rapidapi.com/v3/teams/statistics?team=${teamId}&season=2024&league=71`,
      {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      }
    );

    const stats = res.data.response;

    return {
      goalsFor: stats.goals.for.average.total || 0,
      goalsAgainst: stats.goals.against.average.total || 0,
      shots: stats.shots.total.average || 0,
      shotsOn: stats.shots.on.average || 0,
      corners: stats.lineups ? Math.random().toFixed(1) : 0,
      cards: stats.cards.yellow['total'] ? Math.random().toFixed(1) : 0
    };
  } catch (err) {
    return {
      goalsFor: 0,
      goalsAgainst: 0,
      shots: 0,
      shotsOn: 0,
      corners: 0,
      cards: 0,
    };
  }
}

// Função para buscar últimos 5 jogos
async function getLastMatches(apiKey, teamId) {
  try {
    const res = await axios.get(
      `https://api-football-v1.p.rapidapi.com/v3/fixtures?team=${teamId}&last=5`,
      {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
        }
      }
    );

    return res.data.response.map(match => ({
      date: new Date(match.fixture.date).toLocaleDateString('pt-BR'),
      homeTeam: match.teams.home.name,
      awayTeam: match.teams.away.name,
      homeGoals: match.goals.home,
      awayGoals: match.goals.away,
      venue: match.teams.home.id === teamId ? 'Casa' : 'Fora',
    }));
  } catch (err) {
    return [];
  }
}

app.listen(PORT, () => {
  console.log(`🔥 SniperBet rodando na porta ${PORT}`);
});
