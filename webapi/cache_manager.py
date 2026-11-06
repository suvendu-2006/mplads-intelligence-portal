"""
Aggregate Cache Manager: Instantaneous cache purge across router and aggregator tiers.
"""

import logging

logger = logging.getLogger(__name__)


def invalidate_all_aggregates():
    """
    Clears all router-level and aggregator-level in-memory caches upon database mutations.
    """
    try:
        from webapi.routers import flags, states, mps, districts, constituencies, entity_risks
        from webapi import aggregators

        flags._flags_cache.clear()
        states._states_cache.clear()
        mps._mps_cache.clear()
        mps._mp_detail_cache.clear()
        districts._districts_cache.clear()
        districts._district_detail_cache.clear()
        districts._districts_maps_cache = None
        constituencies._constituency_cache.clear()
        entity_risks._LOCATION_STATE_MAP = None
        entity_risks._MP_STATE_MAP = None
        aggregators._CACHE.clear()
        logger.info("All aggregate caches successfully invalidated.")
    except Exception as e:
        logger.warning(f"Error during aggregate cache invalidation: {e}")
