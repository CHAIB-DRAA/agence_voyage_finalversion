const express = require('express');
const router = express.Router();
const hotelController = require('../controllers/HotelController');


// GET /hotels
router.get('/', hotelController.getHotels);

// POST /hotels (Ajouter)
router.post('/', hotelController.createHotel);

// PUT /hotels/:id (Modifier prix/infos)
router.put('/:id', hotelController.updateHotel);

// DELETE /hotels/:id (Supprimer)
router.delete('/:id', hotelController.deleteHotel);

module.exports = router;