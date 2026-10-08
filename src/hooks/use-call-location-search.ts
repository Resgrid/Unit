import axios from 'axios';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logging';
import { useCoreStore } from '@/stores/app/core-store';

/**
 * The location lookups behind the call forms' address, GPS coordinates, what3words and plus code fields,
 * shared by the new-call and edit-call screens so both offer the same fields and behave the same way.
 */

export interface CallLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

// Google Maps Geocoding API response types
export interface GeocodingResult {
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  place_id: string;
}

interface GeocodingResponse {
  results: GeocodingResult[];
  status: string;
}

// what3words API response types
interface What3WordsResponse {
  country: string;
  square: {
    southwest: {
      lng: number;
      lat: number;
    };
    northeast: {
      lng: number;
      lat: number;
    };
  };
  nearestPlace: string;
  coordinates: {
    lng: number;
    lat: number;
  };
  words: string;
  language: string;
  map: string;
}

const toLocation = (result: GeocodingResult): CallLocation => ({
  latitude: result.geometry.location.lat,
  longitude: result.geometry.location.lng,
  address: result.formatted_address,
});

export const useCallLocationSearch = (onLocationFound: (location: CallLocation) => void) => {
  const { t } = useTranslation();
  const toast = useToast();
  const config = useCoreStore((state) => state.config);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [isGeocodingPlusCode, setIsGeocodingPlusCode] = useState(false);
  const [isGeocodingCoordinates, setIsGeocodingCoordinates] = useState(false);
  const [isGeocodingWhat3Words, setIsGeocodingWhat3Words] = useState(false);
  const [addressResults, setAddressResults] = useState<GeocodingResult[]>([]);
  const [isAddressSelectionOpen, setIsAddressSelectionOpen] = useState(false);

  /**
   * Handles address search using Google Maps Geocoding API
   *
   * Features:
   * - Validates empty/null address input and shows error toast
   * - Uses Google Maps API key from CoreStore configuration
   * - Handles single result: automatically selects location
   * - Handles multiple results: shows bottom sheet for user selection
   * - Handles API errors gracefully with user-friendly messages
   * - URL encodes addresses properly for special characters
   * - Shows loading state during API call
   *
   * @param address - The address string to geocode
   */
  const searchAddress = async (address: string) => {
    if (!address.trim()) {
      toast.warning(t('calls.address_required'));
      return;
    }

    setIsGeocodingAddress(true);
    try {
      const apiKey = config?.GoogleMapsKey;

      if (!apiKey) {
        throw new Error('Google Maps API key not configured');
      }

      const response = await axios.get<GeocodingResponse>(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`);

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const results = response.data.results;

        if (results.length === 1) {
          // Single result - use it directly
          onLocationFound(toLocation(results[0]));
          toast.success(t('calls.address_found'));
        } else {
          // Multiple results - show selection bottom sheet
          setAddressResults(results);
          setIsAddressSelectionOpen(true);
        }
      } else {
        toast.error(t('calls.address_not_found'));
      }
    } catch (error) {
      logger.error({ message: 'Error geocoding address', context: { error } });
      toast.error(t('calls.geocoding_error'));
    } finally {
      setIsGeocodingAddress(false);
    }
  };

  // Handle address selection from the bottom sheet
  const selectAddressResult = (result: GeocodingResult) => {
    onLocationFound(toLocation(result));
    setIsAddressSelectionOpen(false);
    toast.success(t('calls.address_found'));
  };

  const closeAddressSelection = useCallback(() => setIsAddressSelectionOpen(false), []);

  /**
   * Handles what3words search using what3words API
   *
   * Features:
   * - Validates empty/null what3words input and shows error toast
   * - Uses what3words API key from CoreStore configuration
   * - Handles API errors gracefully with user-friendly messages
   * - Shows loading state during API call
   * - Updates coordinates and address fields in form
   * - Validates what3words format (3 words separated by dots)
   *
   * @param what3words - The what3words string to geocode (e.g., "filled.count.soap")
   */
  const searchWhat3Words = async (what3words: string) => {
    if (!what3words.trim()) {
      toast.warning(t('calls.what3words_required'));
      return;
    }

    // Validate what3words format - should be 3 words separated by dots
    const w3wRegex = /^[a-z]+\.[a-z]+\.[a-z]+$/;
    if (!w3wRegex.test(what3words.trim().toLowerCase())) {
      toast.warning(t('calls.what3words_invalid_format'));
      return;
    }

    setIsGeocodingWhat3Words(true);
    try {
      const apiKey = config?.W3WKey;

      if (!apiKey) {
        throw new Error('what3words API key not configured');
      }

      const response = await axios.get<What3WordsResponse>(`https://api.what3words.com/v3/convert-to-coordinates?words=${encodeURIComponent(what3words)}&key=${apiKey}`);

      if (response.data.coordinates) {
        onLocationFound({
          latitude: response.data.coordinates.lat,
          longitude: response.data.coordinates.lng,
          address: response.data.nearestPlace,
        });
        toast.success(t('calls.what3words_found'));
      } else {
        toast.error(t('calls.what3words_not_found'));
      }
    } catch (error) {
      logger.error({ message: 'Error geocoding what3words', context: { error } });
      toast.error(t('calls.what3words_geocoding_error'));
    } finally {
      setIsGeocodingWhat3Words(false);
    }
  };

  /**
   * Handles plus code search using Google Maps Geocoding API
   *
   * Features:
   * - Validates empty/null plus code input and shows error toast
   * - Uses Google Maps API key from CoreStore configuration
   * - Handles API errors gracefully with user-friendly messages
   * - URL encodes plus codes properly for special characters
   * - Shows loading state during API call
   * - Updates coordinates and address fields in form
   *
   * @param plusCode - The plus code string to geocode
   */
  const searchPlusCode = async (plusCode: string) => {
    if (!plusCode.trim()) {
      toast.warning(t('calls.plus_code_required'));
      return;
    }

    setIsGeocodingPlusCode(true);
    try {
      const apiKey = config?.GoogleMapsKey;

      if (!apiKey) {
        throw new Error('Google Maps API key not configured');
      }

      const response = await axios.get<GeocodingResponse>(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(plusCode)}&key=${apiKey}`);

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        onLocationFound(toLocation(response.data.results[0]));
        toast.success(t('calls.plus_code_found'));
      } else {
        toast.error(t('calls.plus_code_not_found'));
      }
    } catch (error) {
      logger.error({ message: 'Error geocoding plus code', context: { error } });
      toast.error(t('calls.plus_code_geocoding_error'));
    } finally {
      setIsGeocodingPlusCode(false);
    }
  };

  /**
   * Handles coordinates search using Google Maps Reverse Geocoding API
   *
   * Features:
   * - Validates and parses coordinates string (lat,lng format)
   * - Uses Google Maps API key from CoreStore configuration
   * - Handles API errors gracefully with user-friendly messages
   * - Shows loading state during API call
   * - Updates address field and map location
   * - Supports various coordinate formats (decimal degrees)
   *
   * @param coordinates - The coordinates string to reverse geocode (e.g., "40.7128, -74.0060")
   */
  const searchCoordinates = async (coordinates: string) => {
    if (!coordinates.trim()) {
      toast.warning(t('calls.coordinates_required'));
      return;
    }

    // Parse coordinates - expect format like "40.7128, -74.0060" or "40.7128,-74.0060"
    const coordRegex = /^(-?\d+\.?\d*),?\s*(-?\d+\.?\d*)$/;
    const match = coordinates.trim().match(coordRegex);

    if (!match) {
      toast.warning(t('calls.coordinates_invalid_format'));
      return;
    }

    const latitude = parseFloat(match[1]);
    const longitude = parseFloat(match[2]);

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      toast.warning(t('calls.coordinates_out_of_range'));
      return;
    }

    setIsGeocodingCoordinates(true);
    try {
      const apiKey = config?.GoogleMapsKey;

      if (!apiKey) {
        throw new Error('Google Maps API key not configured');
      }

      const response = await axios.get<GeocodingResponse>(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`);

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        onLocationFound({ latitude, longitude, address: response.data.results[0].formatted_address });
        toast.success(t('calls.coordinates_found'));
      } else {
        // Even if no address found, still set the location on the map
        onLocationFound({ latitude, longitude, address: undefined });
        toast.info(t('calls.coordinates_no_address'));
      }
    } catch (error) {
      logger.error({ message: 'Error reverse geocoding coordinates', context: { error } });

      // Even if geocoding fails, still set the location on the map
      onLocationFound({ latitude, longitude, address: undefined });
      toast.warning(t('calls.coordinates_geocoding_error'));
    } finally {
      setIsGeocodingCoordinates(false);
    }
  };

  return {
    isGeocodingAddress,
    isGeocodingCoordinates,
    isGeocodingWhat3Words,
    isGeocodingPlusCode,
    addressResults,
    isAddressSelectionOpen,
    closeAddressSelection,
    selectAddressResult,
    searchAddress,
    searchCoordinates,
    searchWhat3Words,
    searchPlusCode,
  };
};
