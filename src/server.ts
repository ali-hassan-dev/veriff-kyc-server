import app from './app';

const port = process.env.PORT || 3000;

// Express 5 passes startup errors (e.g. port already in use) to the listen callback
app.listen(port, (error) => {
  if (error) throw error;
  console.log(`Server is running on port ${port}`);
});
