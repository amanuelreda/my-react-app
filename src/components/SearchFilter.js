import React from 'react';
import './SearchFilter.css';

function SearchFilter({ filters, onFilterChange }) {
  return (
    <div className="search-filter">
      <div className="filter-group">
        <label htmlFor="type">Property Type:</label>
        <select
          id="type"
          value={filters.type}
          onChange={(e) => onFilterChange({ ...filters, type: e.target.value })}
        >
          <option value="all">All Types</option>
          <option value="apartment">Apartment</option>
          <option value="house">House</option>
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="minPrice">Min Price:</label>
        <input
          type="number"
          id="minPrice"
          placeholder="Min"
          min="0"
          step="1"
          value={filters.minPrice}
          onChange={(e) => onFilterChange({ ...filters, minPrice: e.target.value })}
        />
      </div>

      <div className="filter-group">
        <label htmlFor="maxPrice">Max Price:</label>
        <input
          type="number"
          id="maxPrice"
          placeholder="Max"
          min="0"
          step="1"
          value={filters.maxPrice}
          onChange={(e) => onFilterChange({ ...filters, maxPrice: e.target.value })}
        />
      </div>

      <div className="filter-group">
        <label htmlFor="bedrooms">Bedrooms:</label>
        <select
          id="bedrooms"
          value={filters.bedrooms}
          onChange={(e) => onFilterChange({ ...filters, bedrooms: e.target.value })}
        >
          <option value="0">Any</option>
          <option value="1">1+</option>
          <option value="2">2+</option>
          <option value="3">3+</option>
          <option value="4">4+</option>
        </select>
      </div>
    </div>
  );
}

export default SearchFilter;
