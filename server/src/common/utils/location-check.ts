import { getDistance } from 'geolib';
import { BadRequestException } from '@nestjs/common';
import { getSecret } from './secrets';

export async function validateOfficeLocation(
  lat: number,
  lng: number,
) {
  let officeLat: number;
  let officeLng: number;

  try {
    const secretJson = await getSecret(
      'leave-management/production-new',
    );

    const secret = JSON.parse(secretJson);

    officeLat = Number(secret.OFFICE_LAT);
    officeLng = Number(secret.OFFICE_LNG);
  } catch {
    officeLat = Number(process.env.OFFICE_LAT);
    officeLng = Number(process.env.OFFICE_LNG);
  }

  if (!officeLat || !officeLng) {
    throw new Error(
      'Office location is missing',
    );
  }

  const distance = getDistance(
    {
      latitude: lat,
      longitude: lng,
    },
    {
      latitude: officeLat,
      longitude: officeLng,
    },
  );

  if (distance > 50) {
    throw new BadRequestException(
      `Check-in & check-out allowed only inside office. Distance: ${distance}m`,
    );
  }
}