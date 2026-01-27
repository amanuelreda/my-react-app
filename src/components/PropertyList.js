import React from 'react';
import PropertyCard from './PropertyCard';
import './PropertyList.css';

function PropertyList({ properties, onPropertyClick }) {
  if (properties.length === 0) {
    return (
      <div className="no-results">
        <p>No properties found matching your criteria.</p>
      </div>
    );
  }

  return (
    <div className="property-list">
      {properties.map((property) => (
        <PropertyCard 
          key={property.id} 
          property={property} 
          onClick={onPropertyClick}
        />
      ))}
    </div>
  );
}

export default PropertyList;
