# HomeRent - Property Rental Website

A modern React-based single family home and apartment rental listing website.

## Features

- **Property Listings**: Browse apartments and single family homes
- **Advanced Filtering**: Filter by property type, price range, and number of bedrooms
- **Property Details**: View detailed information including amenities, descriptions, and specifications
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Interactive UI**: Click on any property to see full details in a modal

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start the development server
npm start

# Build for production
npm run build
```

The app will open at [http://localhost:3000](http://localhost:3000)

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm test` - Launches the test runner
- `npm run build` - Builds the app for production
- `npm run eject` - Ejects from Create React App (one-way operation)

## Project Structure

```
src/
├── components/        # React components
│   ├── Header.js     # Navigation header
│   ├── SearchFilter.js    # Filter controls
│   ├── PropertyList.js    # Property grid display
│   ├── PropertyCard.js    # Individual property card
│   └── PropertyDetails.js # Property detail modal
├── data/
│   └── properties.js # Sample property data
├── App.js           # Main application component
└── index.js         # Application entry point
```

## Features in Detail

### Property Filtering
- Filter by property type (Apartment or House)
- Set minimum and maximum price range
- Filter by number of bedrooms (1+, 2+, 3+, 4+)

### Property Information
Each property listing includes:
- Property type and title
- Location (city, state, full address)
- Price per month
- Number of bedrooms and bathrooms
- Square footage
- Amenities list
- Detailed description
- Property images

## Technologies Used

- React 19
- Create React App
- CSS3 (with responsive design)
- Modern JavaScript (ES6+)

## License

This project is licensed under the MIT License.
