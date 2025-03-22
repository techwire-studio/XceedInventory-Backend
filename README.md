# Xceed Backend

This is the backend for the Xceed application. It is built with Node.js, Express, and Prisma.

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL

## Installation

1. Clone the repository:

    ```sh
    git clone https://github.com/yourusername/xceed_backend.git
    cd xceed_backend
    ```

2. Install the dependencies:

    ```sh
    npm install
    ```

3. Set up the environment variables:

    Create a `.env` file in the root directory and add the following:

    ```env
    DATABASE_URL="your_postgres_url"
    ```

## Database Migration

1. Run the Prisma migrations to set up the database schema:

    ```sh
    npx prisma migrate deploy
    ```

## Running the Server

1. Start the server:

    ```sh
    npm start
    ```

    The server will be running on `http://localhost:5000`.

## API Endpoints

- `GET /api/products/all-products` - Get all products
- `POST /api/products/upload` - Upload csv for products
- `POST /api/products/add-product` - Create a new product
- `GET /api/orders` - Get all orders
- `POST /api/orders` - Create a new order
- `PATCH /api/orders/:order_id/status` - Modify status of order
- `PATCH /api/orders/:order_id/details` - Modify details of order (only for admin)


## Project Structure

- `src/`
  - `config/`
    - `db.js` - Database configuration
  - `controllers/` - Controllers for handling requests
  - `routes/` - API routes
  - `services/` - Business logic and services
  - `utils/` - Utility functions
  - `index.js` - Entry point of the application
- `prisma/`
  - `schema.prisma` - Prisma schema
  - `migrations/` - Database migrations

## License

This project is licensed under the ISC License.