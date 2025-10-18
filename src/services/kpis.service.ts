import {
  qMusicianConnectionsActive,
  qMusicianRequestsSent,
  qMusicianAvgRating,
  qMusicianActiveBands,
  qStudioMonthlyBookings,
  qStudioMonthlyRevenue,
  qStudioAvgRating,
  qStudioTopWeekday,
  qStudioTopHourBand,
  qStudioBookingHistory,
} from "../repositories/kpis.repository.js";

export async function getKpisForMusician(idUser: number) {
  const [connectionsActive, requestsSent, avgRating, bandsActive] = await Promise.all([
    qMusicianConnectionsActive(idUser),
    qMusicianRequestsSent(idUser),
    qMusicianAvgRating(idUser),
    qMusicianActiveBands(idUser),
  ]);

  return {
    connectionsActive,
    requestsSent,
    avgRating,          // { value: number|null, count: number }
    bandsActive,
  };
}

export async function getKpisForStudio(idUser: number) {
  const [monthlyBookings, monthlyRevenue, avgRating, topWeekday, topHourBand] = await Promise.all([
    qStudioMonthlyBookings(idUser),
    qStudioMonthlyRevenue(idUser),
    qStudioAvgRating(idUser),
    qStudioTopWeekday(idUser),
    qStudioTopHourBand(idUser),
  ]);

  return {
    monthlyBookings,    
    monthlyRevenue,     
    avgRating,          
    topWeekday,         
    topHourBand,        
  };
}

export async function getBookingHistoryForStudio(
  idUser: number,
  pastDays = 90,
  limit = 100
) {
  return qStudioBookingHistory(idUser, pastDays, limit);
}