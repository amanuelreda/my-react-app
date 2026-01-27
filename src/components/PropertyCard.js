import React from 'react';
import './PropertyCard.css';

function PropertyCard({ property, onClick }) {
  return (
    <div className="property-card" onClick={() => onClick(property)}>
      <img src={property.image} alt={property.title} className="property-image" />
      <div className="property-info">
        <div className="property-type-badge">
          {property.type === 'apartment' ? '🏢 Apartment' : '🏡 House'}
        </div>
        <h3 className="property-title">{property.title}</h3>
        <p className="property-address">📍 {property.city}, {property.state}</p>
        <div className="property-details">
          <span>🛏️ {property.bedrooms} bed</span>
          <span>🚿 {property.bathrooms} bath</span>
          <span>📐 {property.sqft} sqft</span>
        </div>
        <div className="property-price">${property.price}/month</div>
      </div>
    </div>
  );
}

export default PropertyCard;
