'use client';

import React, { useState } from 'react';
import { Plus, Map as MapIcon } from 'lucide-react';
import { GoogleMap, useJsApiLoader, DrawingManager } from '@react-google-maps/api';

const MAP_LIBRARIES: ('drawing' | 'geometry' | 'places' | 'visualization')[] = ['drawing'];

export function DeliveryZoneBuilder(): React.JSX.Element {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script-drawing',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
        libraries: MAP_LIBRARIES,
    });

    const [_map, setMap] = useState<google.maps.Map | null>(null);
    const onLoad = React.useCallback(function callback(map: google.maps.Map) {
        setMap(map);
    }, []);
    const onUnmount = React.useCallback(function callback() {
        setMap(null);
    }, []);
    const center = { lat: 9.03, lng: 38.74 };

    return (
        <div className="flex flex-col gap-8 rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-brand-accent flex h-10 w-10 items-center justify-center rounded-xl text-black">
                        <MapIcon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Delivery Zone Builder</h3>
                </div>
                <button className="bg-brand-accent shadow-brand-accent/10 flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-bold text-black transition-all outline-none hover:brightness-105 active:scale-95">
                    <Plus className="h-4 w-4" /> Draw New Polygon
                </button>
            </div>

            <div className="relative aspect-video w-full overflow-hidden rounded-3xl bg-gray-100 ring-1 ring-gray-200">
                {isLoaded ? (
                    <GoogleMap
                        mapContainerStyle={{ width: '100%', height: '100%' }}
                        center={center}
                        zoom={13}
                        onLoad={onLoad}
                        onUnmount={onUnmount}
                        options={{ disableDefaultUI: true }}
                    >
                        <DrawingManager
                            options={{
                                drawingControl: true,
                                drawingControlOptions: {
                                    position: 2,
                                    drawingModes: [google.maps.drawing.OverlayType.POLYGON],
                                },
                                polygonOptions: {
                                    fillOpacity: 0.3,
                                    fillColor: '#DDF853',
                                    strokeColor: '#DDF853',
                                    strokeOpacity: 1,
                                    strokeWeight: 2,
                                },
                            }}
                        />
                    </GoogleMap>
                ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-gray-50/50 p-12 text-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-none ring-1 ring-gray-100">
                            <MapIcon className="h-6 w-6 text-gray-300" />
                        </div>
                        <h4 className="text-sm font-bold text-gray-700">
                            Map Interface for Delivery Zones
                        </h4>
                    </div>
                )}
            </div>
        </div>
    );
}
