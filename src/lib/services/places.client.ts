export class PlacesClientService {
    async validateLocation(location: string): Promise<boolean> {
        try {
            const response = await fetch(`/api/validateLocation?location=${encodeURIComponent(location)}`);
            if (!response.ok) {
                return false;
            }
            return true;
        } catch (error) {
            console.error('Error validating location:', error);
            return false;
        }
    }
} 